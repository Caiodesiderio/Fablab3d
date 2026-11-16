#!/usr/bin/env python3
"""
Sistema de Monitoramento Passivo de Impressoras 3D (Raspberry Pi 4)
Modo Somente Notificacao WhatsApp (Sem alarme fisico e sem envio de e-mails)
- 4x Bambu Lab via MQTT (TLS porta 8883, LAN Mode)
- 3x Creality K1 Max via API Klipper/Moonraker (HTTP porta 7125)
- Halot-Mage Pro 8K e Creality LD-006 (Resina) excluidas da verificacao de rede
- Verifica o Firebase Firestore apos 45s; se nao houver registo nos ultimos 15 min,
  dispara notificacao via CallMeBot (WhatsApp)
"""

import json
import logging
import ssl
import threading
import time
import urllib.parse
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import firebase_admin
import paho.mqtt.client as mqtt
import requests
from firebase_admin import credentials, firestore

# ==============================================================================
# CONFIGURACOES EM CAIXA ALTA (PREENCHA COM OS DADOS DO SEU LABORATORIO)
# ==============================================================================

# 1. Firebase Firestore (Chave privada JSON de Conta de Servico)
SUA_CHAVE_FIREBASE = "/home/pi/fablab/SUA_CHAVE_FIREBASE.json"
COLECAO_IMPRESSOES = "print_logs"
DATABASE_ID_FIRESTORE = "(default)"  # Ou o ID do banco caso utilize banco nomeado

# 2. Impressoras Bambu Lab (Ative "LAN Only Mode" na impressora para obter IP e Access Code)
BAMBU_PRINTERS = {
    "Bambu H2D": {
        "ip": "IP_BAMBU_H2D",
        "serial": "SERIAL_BAMBU_H2D",
        "access_code": "CODIGO_ACESSO_BAMBU_H2D",
    },
    "Bambu P2S": {
        "ip": "IP_BAMBU_P2S",
        "serial": "SERIAL_BAMBU_P2S",
        "access_code": "CODIGO_ACESSO_BAMBU_P2S",
    },
    "Bambu X2D": {
        "ip": "IP_BAMBU_X2D",
        "serial": "SERIAL_BAMBU_X2D",
        "access_code": "CODIGO_ACESSO_BAMBU_X2D",
    },
    "Bambu A1 Mini": {
        "ip": "IP_BAMBU_A1_MINI",
        "serial": "SERIAL_BAMBU_A1_MINI",
        "access_code": "CODIGO_ACESSO_BAMBU_A1_MINI",
    },
}

# 3. Impressoras Creality K1 Max (API Klipper / Moonraker)
K1_MAX_PRINTERS = {
    "Creality K1 Max 01": "http://IP_K1_MAX_01:7125",
    "Creality K1 Max 02": "http://IP_K1_MAX_02:7125",
    "Creality K1 Max 03": "http://IP_K1_MAX_03:7125",
}

# 4. Janela de Validacao (em segundos / minutos)
TEMPO_ESPERA_REGISTO_S = 45
JANELA_TOLERANCIA_MIN = 15

# 5. CallMeBot WhatsApp API
SEU_TELEFONE_WHATSAPP = "5511999999999"  # Codigo pais + DDD + Numero (sem '+')
SUA_CHAVE_CALLMEBOT = "SUA_CHAVE_CALLMEBOT"

# ==============================================================================
# INICIALIZACAO DE LOGS E FIREBASE
# ==============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("ocean-fablab-monitor")

cred = credentials.Certificate(SUA_CHAVE_FIREBASE)
firebase_admin.initialize_app(cred)
db = (
    firestore.client()
    if DATABASE_ID_FIRESTORE == "(default)"
    else firestore.client(database_id=DATABASE_ID_FIRESTORE)
)

printer_prev_printing = defaultdict(bool)
pending_checks = set()
pending_lock = threading.Lock()


# ==============================================================================
# NOTIFICACAO WHATSAPP E VALIDACAO NO FIRESTORE
# ==============================================================================


def send_whatsapp_notification(machine_name: str) -> None:
    """Envia notificacao via API CallMeBot quando uma impressao nao foi registada."""
    message = (
        f"SAMSUNG OCEAN FABLAB 3D: Impressao iniciada na maquina '{machine_name}' "
        f"sem registo de filamento nos ultimos {JANELA_TOLERANCIA_MIN} minutos. "
        f"Por favor, efetue o cadastro no sistema."
    )
    encoded_msg = urllib.parse.quote(message)
    url = (
        f"https://api.callmebot.com/whatsapp.php?"
        f"phone={SEU_TELEFONE_WHATSAPP}&text={encoded_msg}&apikey={SUA_CHAVE_CALLMEBOT}"
    )
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            logger.info("Notificacao WhatsApp enviada para '%s'.", machine_name)
        else:
            logger.error("Falha CallMeBot (%s): %s", resp.status_code, resp.text)
    except Exception as exc:
        logger.error("Erro ao contactar CallMeBot: %s", exc)


def has_recent_registration(machine_name: str) -> bool:
    """Consulta o Firestore pelos ultimos 15 minutos para a maquina especifica."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=JANELA_TOLERANCIA_MIN)
    try:
        query_ref = (
            db.collection(COLECAO_IMPRESSOES)
            .where("machine", "==", machine_name)
            .where("createdAt", ">=", cutoff)
            .limit(1)
        )
        docs = list(query_ref.stream())
        return len(docs) > 0
    except Exception as exc:
        logger.error("Erro ao consultar Firestore para '%s': %s", machine_name, exc)
        return True


def verify_print_after_delay(machine_name: str) -> None:
    """Aguarda 45s apos deteccao de impressao e envia notificacao se nao houver cadastro."""
    try:
        logger.info(
            "Impressao detetada em '%s'. Aguardando %ds para validar cadastro...",
            machine_name,
            TEMPO_ESPERA_REGISTO_S,
        )
        time.sleep(TEMPO_ESPERA_REGISTO_S)

        if has_recent_registration(machine_name):
            logger.info("Registo confirmado no Firebase para '%s'.", machine_name)
        else:
            logger.warning(
                "Nenhum registo encontrado para '%s'. Enviando notificacao WhatsApp...",
                machine_name,
            )
            send_whatsapp_notification(machine_name)
    finally:
        with pending_lock:
            pending_checks.discard(machine_name)


def handle_printer_state(machine_name: str, is_now_printing: bool) -> None:
    """Deteta transicao para estado 'printing' sem duplicar verificacoes."""
    was_printing = printer_prev_printing[machine_name]
    printer_prev_printing[machine_name] = is_now_printing

    if is_now_printing and not was_printing:
        with pending_lock:
            if machine_name in pending_checks:
                return
            pending_checks.add(machine_name)
        threading.Thread(
            target=verify_print_after_delay,
            args=(machine_name,),
            daemon=True,
        ).start()


# ==============================================================================
# MONITORAMENTO BAMBU LAB (MQTT) & CREALITY K1 MAX (KLIPPER / MOONRAKER)
# ==============================================================================


def start_bambu_mqtt_listener(machine_name: str, cfg: dict) -> None:
    """Escuta o topico report via MQTT TLS da impressora Bambu Lab em LAN Mode."""
    topic = f"device/{cfg['serial']}/report"

    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            logger.info("MQTT conectado em %s (%s).", machine_name, cfg["ip"])
            client.subscribe(topic)
        else:
            logger.warning("Falha conexao MQTT em %s (rc=%s).", machine_name, rc)

    def on_message(client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            print_block = payload.get("print")
            if not isinstance(print_block, dict):
                return
            gcode_state = str(print_block.get("gcode_state", "")).upper()
            if not gcode_state:
                return
            is_printing = gcode_state in ("RUNNING", "PRINTING")
            handle_printer_state(machine_name, is_printing)
        except Exception as exc:
            logger.debug("Mensagem MQTT ignorada (%s): %s", machine_name, exc)

    client = mqtt.Client(client_id=f"ocean_fablab_pi_{cfg['serial']}")
    client.username_pw_set("bblp", cfg["access_code"])
    client.tls_set(cert_reqs=ssl.CERT_NONE)
    client.tls_insecure_set(True)
    client.on_connect = on_connect
    client.on_message = on_message

    while True:
        try:
            client.connect(cfg["ip"], 8883, keepalive=60)
            client.loop_forever()
        except Exception as exc:
            logger.error("Erro MQTT %s (%s). Tentando novamente em 15s.", machine_name, exc)
            time.sleep(15)


def poll_klipper_printers() -> None:
    """Consulta a API Moonraker das 3 Creality K1 Max a cada 5 segundos."""
    while True:
        for machine_name, base_url in K1_MAX_PRINTERS.items():
            url = f"{base_url}/printer/objects/query?print_stats"
            try:
                resp = requests.get(url, timeout=4)
                if resp.status_code == 200:
                    data = resp.json()
                    state = (
                        data.get("result", {})
                        .get("status", {})
                        .get("print_stats", {})
                        .get("state", "")
                        .lower()
                    )
                    handle_printer_state(machine_name, state == "printing")
            except Exception as exc:
                logger.debug("Moonraker indisponivel (%s): %s", machine_name, exc)
        time.sleep(5)


def main() -> None:
    logger.info("Iniciando monitorizacao passiva WhatsApp — Samsung Ocean FabLab 3D...")

    for machine_name, cfg in BAMBU_PRINTERS.items():
        threading.Thread(
            target=start_bambu_mqtt_listener,
            args=(machine_name, cfg),
            daemon=True,
        ).start()

    threading.Thread(target=poll_klipper_printers, daemon=True).start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Encerrando servico de monitoramento.")


if __name__ == "__main__":
    main()
