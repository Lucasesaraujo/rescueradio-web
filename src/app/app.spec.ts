import { TestBed } from '@angular/core/testing';
import { App } from './app';

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sentMessages: string[] = [];

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  send(message: string): void {
    this.sentMessages.push(message);
  }

  close(): void {
    this.emitClose();
  }

  emitOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  emitMessage(payload: object): void {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }

  emitClose(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new Event('close') as CloseEvent);
  }
}

describe('App', () => {
  beforeEach(async () => {
    MockWebSocket.instances = [];
    localStorage.clear();
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);

    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    vi.unstubAllGlobals();
    delete window.__RESCUERADIO_CONFIG__;
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('RescueRadio');
  });

  it('connects using the configured WebSocket URL', () => {
    window.__RESCUERADIO_CONFIG__ = {
      gatewayWsUrl: 'ws://gateway.example.com/',
    };
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.username = ' Lucas ';
    app.connect();

    expect(MockWebSocket.instances[0].url).toBe(
      'ws://gateway.example.com/ws/channel/canal-geral?usuario=Lucas'
    );
    expect(app.connectionStatus).toBe('Conectando');
    expect(localStorage.getItem('rescueradio.activeSession')).toContain('Lucas');
  });

  it('restores the active session after a page refresh', () => {
    localStorage.setItem(
      'rescueradio.activeSession',
      JSON.stringify({
        username: 'Julia',
        channelId: 'canal-geral',
      })
    );

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    expect(app.username).toBe('Julia');
    expect(app.connectionStatus).toBe('Reconectando');
    expect(MockWebSocket.instances[0].url).toContain('usuario=Julia');
  });

  it('clears the active session when the user leaves the channel', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.username = 'Lucas';
    app.connect();

    expect(localStorage.getItem('rescueradio.activeSession')).toContain('Lucas');

    app.disconnect();

    expect(localStorage.getItem('rescueradio.activeSession')).toBeNull();
  });

  it('sends a message and shows it locally without waiting for server echo', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.username = 'Lucas';
    app.connect();
    const socket = MockWebSocket.instances[0];
    socket.emitOpen();

    app.messageText = 'Equipe Alfa chegou ao local.';
    app.sendMessage();

    expect(socket.sentMessages).toHaveLength(1);
    expect(JSON.parse(socket.sentMessages[0])).toMatchObject({
      type: 'SEND_MESSAGE',
      usuario: 'Lucas',
      corpo_texto: 'Equipe Alfa chegou ao local.',
    });
    expect(app.messages).toHaveLength(1);
    expect(app.messages[0].corpo_texto).toBe('Equipe Alfa chegou ao local.');
    expect(app.messageText).toBe('');
  });

  it('receives messages from other rescuers through the server event stream', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.username = 'Lucas';
    app.connect();
    const socket = MockWebSocket.instances[0];
    socket.emitOpen();
    socket.emitMessage({
      type: 'MESSAGE_RECEIVED',
      channel_id: 'canal-geral',
      payload: {
        type: 'SEND_MESSAGE',
        usuario: 'Marcelo',
        timestamp_iso: '2026-06-20T12:00:00Z',
        corpo_texto: 'Equipe Bravo a caminho.',
      },
    });

    expect(app.messages).toEqual([
      {
        type: 'SEND_MESSAGE',
        usuario: 'Marcelo',
        timestamp_iso: '2026-06-20T12:00:00Z',
        corpo_texto: 'Equipe Bravo a caminho.',
      },
    ]);
  });

  it('marks the UI as reconnecting and opens a new WebSocket after an unexpected close', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.username = 'Lucas';
    app.connect();
    const firstSocket = MockWebSocket.instances[0];
    firstSocket.emitOpen();
    firstSocket.emitClose();

    expect(app.connected).toBe(false);
    expect(app.connectionStatus).toBe('Reconectando');

    vi.advanceTimersByTime(2000);

    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[1].url).toContain('usuario=Lucas');
  });
});
