export type Role = "operador" | "comandante" | "admin";

export interface RescueUser {
  username: string;
  display_name?: string;
  role: Role;
  base_id?: string;
  uf_scope?: string | null;
  profile?: RescueProfile | null;
  [key: string]: any;
}

export interface RescueProfile {
  username?: string;
  full_name?: string;
  display_name?: string;
  callsign?: string;
  operational_name?: string;
  nome_operacional?: string;
  base_id?: string;
  function?: string;
  funcao?: string;
  contact?: string;
  contato?: string;
  email?: string;
  status?: "disponivel" | "em_operacao" | "indisponivel";
  connection_status?: "online" | "offline";
  last_seen_at?: string | null;
  skills?: string[];
  competencias?: string[];
  complete?: boolean;
  [key: string]: any;
}

export interface ProfileStatus {
  user?: RescueUser;
  profile?: RescueProfile | null;
  complete?: boolean;
}

export function normalizeProfile(
  input: RescueProfile | ProfileStatus | null | undefined,
): RescueProfile | null {
  if (!input) return null;
  const status = input as ProfileStatus;
  const raw = status.profile !== undefined ? status.profile : (input as RescueProfile);
  if (!raw) return status.complete ? { complete: true } : null;
  const skills = Array.isArray(raw.skills)
    ? raw.skills
    : Array.isArray(raw.competencias)
      ? raw.competencias
      : [];
  return {
    ...raw,
    full_name: raw.full_name || raw.operational_name || raw.nome_operacional || "",
    display_name: raw.display_name || raw.operational_name || raw.nome_operacional || "",
    callsign: raw.callsign || "",
    operational_name: raw.operational_name || raw.nome_operacional || "",
    nome_operacional: raw.nome_operacional || raw.operational_name || "",
    function: raw.function || raw.funcao || "",
    funcao: raw.funcao || raw.function || "",
    contact: raw.contact || raw.contato || "",
    contato: raw.contato || raw.contact || "",
    email: raw.email || "",
    skills,
    competencias: skills,
    complete:
      typeof status.complete === "boolean"
        ? status.complete
        : Boolean(raw.full_name || raw.operational_name || raw.nome_operacional) &&
          Boolean(raw.base_id),
  };
}

export function profileToApiPayload(form: {
  full_name?: string;
  display_name?: string;
  callsign?: string;
  nome_operacional: string;
  base_id: string;
  contato: string;
  email?: string;
  status: string;
  competencias: string | string[];
}) {
  const skills = Array.isArray(form.competencias)
    ? form.competencias
    : form.competencias
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  return {
    full_name: form.full_name?.trim() || form.nome_operacional.trim(),
    display_name: form.display_name?.trim(),
    callsign: form.callsign?.trim(),
    operational_name: form.nome_operacional.trim(),
    base_id: form.base_id.trim(),
    function: "",
    contact: form.contato.trim(),
    email: form.email?.trim() || "",
    status: form.status,
    skills,
  };
}

export function normalizeOperator(input: any) {
  const profile = normalizeProfile(input) || input || {};
  return {
    ...input,
    ...profile,
    username: input?.username || profile.username,
    display_name:
      input?.display_name ||
      profile.operational_name ||
      profile.nome_operacional ||
      input?.username,
    funcao: profile.funcao || profile.function,
    competencias: profile.competencias || profile.skills || [],
  };
}

export function normalizeOccurrence(input: any) {
  if (!input) return input;
  return {
    ...input,
    titulo: input.titulo || input.title || "",
    title: input.title || input.titulo || "",
    tipo: input.tipo || input.type || "",
    type: input.type || input.tipo || "",
    prioridade: input.prioridade || input.priority || "normal",
    priority: input.priority || input.prioridade || "normal",
    endereco: input.endereco || input.address_text || "",
    address_text: input.address_text || input.endereco || "",
    descricao: input.descricao || input.description || "",
    description: input.description || input.descricao || "",
  };
}

export function normalizeOperation(input: any) {
  if (!input) return input;
  const occurrence = normalizeOccurrence(input.occurrence || input.ocorrencia || input);
  return {
    ...input,
    occurrence,
    titulo: input.titulo || input.title || occurrence?.title || input.id,
    title: input.title || input.titulo || occurrence?.title || input.id,
    tipo: input.tipo || occurrence?.type,
    prioridade: input.prioridade || input.priority || occurrence?.priority || "normal",
    participants: input.participants || input.participantes || input.members || [],
    participantes: input.participantes || input.participants || input.members || [],
    closing_summary: input.closing_summary || input.resumo || "",
    resumo: input.resumo || input.closing_summary || "",
  };
}

export function normalizeChatMessage(input: any, fallbackKind: string = "live") {
  const text = input?.corpo_texto || input?.text || input?.content || input?.message || "";
  const author =
    input?.usuario || input?.display_name || input?.author || input?.username || "Sistema";
  return {
    ...input,
    id: String(
      input?.id || input?.message_id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ),
    text,
    author,
    username: input?.username || input?.usuario,
    timestamp:
      input?.timestamp_iso || input?.timestamp || input?.created_at || new Date().toISOString(),
    channel: input?.channel_id || input?.channel,
    kind: input?.kind || fallbackKind,
  };
}
