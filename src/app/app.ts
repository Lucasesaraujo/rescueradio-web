import { ChangeDetectorRef, Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { getGatewayWebSocketUrl } from './runtime-config';

type RescueRadioEvent = {
  type: string;
  channel_id?: string;
  usuario?: string;
  message?: string;
  messages?: RescueRadioMessage[];
  members?: { usuario: string; status: string }[];
  payload?: RescueRadioMessage;
};

type RescueRadioMessage = {
  type: string;
  usuario: string;
  timestamp_iso: string;
  corpo_texto: string;
};

const ACTIVE_SESSION_STORAGE_KEY = 'rescueradio.activeSession';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  @ViewChild('messagesViewport') messagesViewport?: ElementRef<HTMLElement>;

  username = '';
  messageText = '';
  channelId = 'canal-geral';

  socket: WebSocket | null = null;

  connected = false;
  connectionStatus = 'Desconectado';

  messages: RescueRadioMessage[] = [];
  systemEvents: string[] = [];
  members: { usuario: string; status: string }[] = [];

  private manualDisconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly reconnectDelayMs = 2000;

  constructor(
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const activeSession = this.getStoredActiveSession();

    if (!activeSession) {
      return;
    }

    this.username = activeSession.username;
    this.channelId = activeSession.channelId;
    this.manualDisconnect = false;
    this.openSocket(true);
  }

  connect(): void {
    this.manualDisconnect = false;
    this.openSocket(false);
  }

  disconnect(): void {
    this.manualDisconnect = true;
    this.clearReconnectTimer();
    this.clearStoredActiveSession();
    this.socket?.close();
    this.socket = null;
    this.connected = false;
    this.connectionStatus = 'Desconectado';
  }

  sendMessage(): void {
    const text = this.messageText.trim();
    const cleanedUsername = this.username.trim();

    if (!text || !cleanedUsername || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: RescueRadioMessage = {
      type: 'SEND_MESSAGE',
      usuario: cleanedUsername,
      timestamp_iso: new Date().toISOString(),
      corpo_texto: text,
    };

    this.socket.send(JSON.stringify(message));
    this.messages.push(message);
    this.messageText = '';
    this.scrollMessagesToBottom();
  }

  private openSocket(isReconnect: boolean): void {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const cleanedUsername = this.username.trim();

    if (!cleanedUsername) {
      alert('Informe seu nome antes de entrar no canal.');
      return;
    }

    this.username = cleanedUsername;
    this.storeActiveSession(cleanedUsername);

    const url = this.buildWebSocketUrl(cleanedUsername);

    this.socket = new WebSocket(url);
    this.connectionStatus = isReconnect ? 'Reconectando' : 'Conectando';

    this.socket.onopen = () => {
      this.updateView(() => {
        this.clearReconnectTimer();
        this.connected = true;
        this.connectionStatus = 'Conectado';
        this.addSystemEvent(
          isReconnect
            ? `${cleanedUsername} reconectado ao canal.`
            : `${cleanedUsername} conectado ao canal.`
        );
      });
    };

    this.socket.onmessage = (event) => {
      this.updateView(() => {
        try {
          const data: RescueRadioEvent = JSON.parse(event.data);
          this.handleSocketEvent(data);
        } catch {
          this.addSystemEvent('Evento invalido recebido do servidor.');
        }
      });
    };

    this.socket.onerror = () => {
      this.updateView(() => {
        this.connectionStatus = 'Erro de conexao';
        this.addSystemEvent('Erro na conexao com o canal.');
      });
    };

    this.socket.onclose = () => {
      this.updateView(() => {
        this.connected = false;
        this.socket = null;

        if (this.manualDisconnect) {
          this.connectionStatus = 'Desconectado';
          this.addSystemEvent('Conexao encerrada.');
          return;
        }

        this.connectionStatus = 'Reconectando';
        this.addSystemEvent('Conexao perdida. Tentando reconectar...');
        this.scheduleReconnect();
      });
    };
  }

  private handleSocketEvent(event: RescueRadioEvent): void {
    switch (event.type) {
      case 'CONNECTED':
        this.addSystemEvent(event.message ?? 'Conectado ao canal.');
        break;

      case 'BRIEFING':
        this.messages = event.messages ?? [];
        this.addSystemEvent(`Briefing recebido com ${this.messages.length} mensagem(ns).`);
        this.scrollMessagesToBottom();
        break;

      case 'MESSAGE_RECEIVED':
        if (event.payload) {
          this.messages.push(event.payload);
          this.scrollMessagesToBottom();
        }
        break;

      case 'MEMBER_JOINED':
        this.members = event.members ?? this.members;
        this.addSystemEvent(event.message ?? `${event.usuario} entrou no canal.`);
        break;

      case 'MEMBER_LEFT':
        this.members = event.members ?? this.members;
        this.addSystemEvent(event.message ?? `${event.usuario} saiu do canal.`);
        break;

      case 'ERROR':
        this.addSystemEvent(`Erro: ${event.message}`);
        break;

      default:
        this.addSystemEvent(`Evento desconhecido: ${event.type}`);
        break;
    }
  }

  private addSystemEvent(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.systemEvents.push(`[${timestamp}] ${message}`);
  }

  private buildWebSocketUrl(username: string): string {
    const gatewayUrl = getGatewayWebSocketUrl();
    return `${gatewayUrl}/ws/channel/${this.channelId}?usuario=${encodeURIComponent(username)}`;
  }

  private storeActiveSession(username: string): void {
    localStorage.setItem(
      ACTIVE_SESSION_STORAGE_KEY,
      JSON.stringify({
        username,
        channelId: this.channelId,
      })
    );
  }

  private getStoredActiveSession(): { username: string; channelId: string } | null {
    const rawSession = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);

    if (!rawSession) {
      return null;
    }

    try {
      const session = JSON.parse(rawSession);

      if (
        typeof session.username !== 'string' ||
        !session.username.trim() ||
        typeof session.channelId !== 'string' ||
        !session.channelId.trim()
      ) {
        this.clearStoredActiveSession();
        return null;
      }

      return {
        username: session.username.trim(),
        channelId: session.channelId.trim(),
      };
    } catch {
      this.clearStoredActiveSession();
      return null;
    }
  }

  private clearStoredActiveSession(): void {
    localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket(true);
    }, this.reconnectDelayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer === null) {
      return;
    }

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private scrollMessagesToBottom(): void {
    setTimeout(() => {
      const viewport = this.messagesViewport?.nativeElement;

      if (!viewport) {
        return;
      }

      viewport.scrollTop = viewport.scrollHeight;
    });
  }

  private updateView(callback: () => void): void {
    this.zone.run(() => {
      callback();
      this.cdr.detectChanges();
    });
  }
}
