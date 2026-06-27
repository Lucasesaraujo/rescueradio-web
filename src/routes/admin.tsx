import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/RoleGuard";
import { Shell } from "@/components/Shell";
import { ConfirmDialog, type ConfirmDialogState } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import {
  Building2,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Ticket,
  Trash2,
  Users,
  X,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: () => (
    <AuthGuard roles={["admin"]}>
      <Shell>
        <AdminPage />
      </Shell>
    </AuthGuard>
  ),
});

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const CITY_PRESETS = [
  {
    city: "Recife",
    uf: "PE",
    latitude: -8.0476,
    longitude: -34.877,
    coverage_cities: [
      "Recife",
      "Olinda",
      "Paulista",
      "Jaboatao dos Guararapes",
      "Camaragibe",
      "Abreu e Lima",
      "Cabo de Santo Agostinho",
      "Igarassu",
      "Ipojuca",
      "Sao Lourenco da Mata",
    ],
  },
  {
    city: "Fortaleza",
    uf: "CE",
    latitude: -3.7319,
    longitude: -38.5267,
    coverage_cities: ["Fortaleza", "Caucaia", "Maracanau", "Maranguape", "Eusebio", "Aquiraz"],
  },
  {
    city: "Salvador",
    uf: "BA",
    latitude: -12.9777,
    longitude: -38.5016,
    coverage_cities: ["Salvador", "Lauro de Freitas", "Camacari", "Simoes Filho", "Vera Cruz"],
  },
];

type AdminSection = "users" | "bases";

function AdminPage() {
  const routeSearch = useRouterState({ select: (state) => state.location.search as any });
  const section = getSection(routeSearch);
  const [users, setUsers] = useState<any[]>([]);
  const [bases, setBases] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [createdInviteCode, setCreatedInviteCode] = useState("");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [baseModalOpen, setBaseModalOpen] = useState(false);
  const [savingInvite, setSavingInvite] = useState(false);
  const [savingBase, setSavingBase] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [newBase, setNewBase] = useState(emptyBaseForm());
  const [newInvite, setNewInvite] = useState({
    role: "operador",
    base_id: "",
    uf_scope: "PE",
    expires_in_hours: 72,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedUsers, loadedBases, loadedInvites] = await Promise.all([
        api<any[]>("/users").catch(() => []),
        api<any[]>("/bases").catch(() => []),
        api<any[]>("/invites").catch(() => []),
      ]);
      setUsers(Array.isArray(loadedUsers) ? loadedUsers : []);
      setBases(Array.isArray(loadedBases) ? loadedBases : []);
      setInvites(Array.isArray(loadedInvites) ? loadedInvites : []);
      if (Array.isArray(loadedBases) && loadedBases[0]?.id) {
        setNewInvite((prev) => ({
          ...prev,
          base_id: prev.base_id || loadedBases[0].id,
          uf_scope: prev.uf_scope || loadedBases[0].uf || "PE",
        }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cityPreset = useMemo(
    () => findCityPreset(newBase.city, newBase.uf),
    [newBase.city, newBase.uf],
  );

  const runConfirmedAction = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    try {
      await confirmState.onConfirm();
      setConfirmState(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const updateUser = async (user: any) => {
    const payload =
      user.role === "admin"
        ? { role: "admin", base_id: null, uf_scope: null }
        : user.role === "comandante"
          ? { role: "comandante", base_id: null, uf_scope: user.uf_scope || "PE" }
          : {
              role: "operador",
              base_id: user.base_id || user.profile?.base_id || bases[0]?.id,
              uf_scope: null,
            };

    setConfirmState({
      title: "Atualizar acesso",
      description: `Salvar o escopo de acesso de ${user.username}?`,
      confirmLabel: "Salvar acesso",
      variant: "warning",
      onConfirm: async () => {
        await api(`/users/${encodeURIComponent(user.username)}/role`, {
          method: "PATCH",
          json: payload,
        });
        load();
      },
    });
  };

  const createInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingInvite(true);
    setCreatedInviteCode("");
    const payload =
      newInvite.role === "admin"
        ? { role: "admin", base_id: null, uf_scope: null }
        : newInvite.role === "comandante"
          ? { role: "comandante", base_id: null, uf_scope: newInvite.uf_scope }
          : { role: "operador", base_id: newInvite.base_id, uf_scope: null };

    try {
      const res = await api<any>("/invites", {
        method: "POST",
        json: {
          ...payload,
          expires_in_hours: Number(newInvite.expires_in_hours) || 72,
        },
      });
      setCreatedInviteCode(res.code || "");
      load();
    } catch (e: any) {
      alert(e?.message || "Falha ao criar convite");
    } finally {
      setSavingInvite(false);
    }
  };

  const revokeInvite = async (invite: any) => {
    setConfirmState({
      title: "Revogar convite",
      description: `O convite para ${invite.role} sera invalidado.`,
      confirmLabel: "Revogar",
      variant: "warning",
      onConfirm: async () => {
        await api(`/invites/${encodeURIComponent(invite.id)}`, { method: "DELETE" });
        load();
      },
    });
  };

  const createBase = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingBase(true);
    try {
      const preset = findCityPreset(newBase.city, newBase.uf);
      await api("/bases", {
        method: "POST",
        json: {
          id: newBase.id,
          name: newBase.name,
          city: newBase.city,
          uf: newBase.uf,
          latitude: parseOptionalNumber(newBase.latitude) ?? preset?.latitude ?? null,
          longitude: parseOptionalNumber(newBase.longitude) ?? preset?.longitude ?? null,
          coverage_cities: parseCities(newBase.coverage_cities).length
            ? parseCities(newBase.coverage_cities)
            : preset?.coverage_cities || [newBase.city],
        },
      });
      setNewBase(emptyBaseForm());
      setBaseModalOpen(false);
      load();
    } catch (e: any) {
      alert(e?.message || "Falha ao criar base");
    } finally {
      setSavingBase(false);
    }
  };

  const updateBase = async (base: any) => {
    const preset = findCityPreset(base.city, base.uf || "PE");
    await api(`/bases/${encodeURIComponent(base.id)}`, {
      method: "PATCH",
      json: {
        name: base.name,
        city: base.city,
        uf: base.uf || preset?.uf || "PE",
        latitude: parseOptionalNumber(base.latitude) ?? preset?.latitude ?? null,
        longitude: parseOptionalNumber(base.longitude) ?? preset?.longitude ?? null,
        coverage_cities: parseCities(base.coverage_cities_text || base.coverage_cities || []).length
          ? parseCities(base.coverage_cities_text || base.coverage_cities || [])
          : preset?.coverage_cities || [base.city],
      },
    });
    load();
  };

  const deleteBase = async (base: any) => {
    setConfirmState({
      title: "Excluir base",
      description: `A base ${base.name || base.id} sera removida do cadastro.`,
      confirmLabel: "Excluir base",
      variant: "danger",
      onConfirm: async () => {
        await api(`/bases/${encodeURIComponent(base.id)}`, { method: "DELETE" });
        load();
      },
    });
  };

  const applyPreset = (preset: (typeof CITY_PRESETS)[number]) => {
    setNewBase((prev) => ({
      ...prev,
      city: preset.city,
      uf: preset.uf,
      latitude: String(preset.latitude),
      longitude: String(preset.longitude),
      coverage_cities: preset.coverage_cities.join(", "),
      id: prev.id || `base-${normalizeSlug(preset.city)}`,
      name: prev.name || `Base ${preset.city}`,
    }));
  };

  return (
    <div className="h-full overflow-auto p-4">
      <ConfirmDialog
        open={!!confirmState}
        state={confirmState}
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setConfirmState(null)}
        onConfirm={runConfirmedAction}
      />
      <InviteModal
        open={inviteModalOpen}
        bases={bases}
        invite={newInvite}
        createdCode={createdInviteCode}
        busy={savingInvite}
        onChange={setNewInvite}
        onClose={() => {
          setInviteModalOpen(false);
          setCreatedInviteCode("");
        }}
        onSubmit={createInvite}
      />
      <BaseModal
        open={baseModalOpen}
        form={newBase}
        cityPreset={cityPreset}
        busy={savingBase}
        onChange={setNewBase}
        onApplyPreset={applyPreset}
        onClose={() => setBaseModalOpen(false)}
        onSubmit={createBase}
      />

      {section === "bases" ? (
        <BasesSection
          bases={bases}
          loading={loading}
          onRefresh={load}
          onCreate={() => setBaseModalOpen(true)}
          onUpdate={updateBase}
          onDelete={deleteBase}
          onDraft={setBases}
        />
      ) : (
        <UsersSection
          users={users}
          bases={bases}
          invites={invites}
          loading={loading}
          onRefresh={load}
          onCreateInvite={() => setInviteModalOpen(true)}
          onUpdateUser={updateUser}
          onUsersDraft={setUsers}
          onRevokeInvite={revokeInvite}
        />
      )}
    </div>
  );
}

function UsersSection({
  users,
  bases,
  invites,
  loading,
  onRefresh,
  onCreateInvite,
  onUpdateUser,
  onUsersDraft,
  onRevokeInvite,
}: {
  users: any[];
  bases: any[];
  invites: any[];
  loading: boolean;
  onRefresh: () => void;
  onCreateInvite: () => void;
  onUpdateUser: (user: any) => void;
  onUsersDraft: React.Dispatch<React.SetStateAction<any[]>>;
  onRevokeInvite: (invite: any) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-md border border-border bg-surface">
        <SectionHeader
          icon={<Users className="h-4 w-4" />}
          title="Usuarios"
          subtitle="Admin global, comandante por UF, operador por base"
          action={
            <button
              onClick={onCreateInvite}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Criar convite
            </button>
          }
          loading={loading}
          onRefresh={onRefresh}
        />
        {loading ? (
          <LoadingState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left">Usuario</th>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">Papel</th>
                  <th className="px-3 py-2 text-left">Escopo</th>
                  <th className="px-3 py-2 text-right">Acao</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.username} className="border-b border-border/60 hover:bg-surface-2">
                    <td className="px-3 py-2 font-mono text-xs">{user.username}</td>
                    <td className="px-3 py-2">
                      {user.display_name || user.profile?.display_name || "-"}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={user.role}
                        onChange={(event) =>
                          onUsersDraft((prev) =>
                            prev.map((item) =>
                              item.username === user.username
                                ? { ...item, role: event.target.value }
                                : item,
                            ),
                          )
                        }
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                      >
                        <option value="operador">operador</option>
                        <option value="comandante">comandante</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {user.role === "admin" ? (
                        <span className="text-xs text-muted-foreground">Global</span>
                      ) : user.role === "comandante" ? (
                        <UfSelect
                          value={user.uf_scope || "PE"}
                          onChange={(uf) =>
                            onUsersDraft((prev) =>
                              prev.map((item) =>
                                item.username === user.username ? { ...item, uf_scope: uf } : item,
                              ),
                            )
                          }
                        />
                      ) : (
                        <select
                          value={user.base_id || user.profile?.base_id || ""}
                          onChange={(event) =>
                            onUsersDraft((prev) =>
                              prev.map((item) =>
                                item.username === user.username
                                  ? { ...item, base_id: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                        >
                          <option value="">Selecione...</option>
                          {bases.map((base) => (
                            <option key={base.id} value={base.id}>
                              {base.name || base.id}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => onUpdateUser(user)}
                        className="inline-flex items-center gap-1 rounded-md border border-primary/40 px-2 py-1 text-xs font-semibold text-primary"
                      >
                        <Save className="h-3.5 w-3.5" /> Salvar
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">
                      Nenhum usuario.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <PanelTitle
          icon={<Ticket className="h-4 w-4" />}
          title="Convites ativos"
          subtitle="Codigos ainda validos para cadastro"
        />
        <ul className="max-h-[70vh] space-y-2 overflow-y-auto text-xs">
          {invites.map((invite) => {
            const used = Boolean(invite.used_by);
            const revoked = Boolean(invite.revoked_at);
            return (
              <li key={invite.id} className="rounded border border-border bg-background p-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono uppercase tracking-wide text-muted-foreground">
                      {invite.role} - {invite.uf_scope || invite.base_id || "global"}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {used
                        ? `Usado por ${invite.used_by}`
                        : revoked
                          ? "Revogado"
                          : `Expira em ${formatDate(invite.expires_at)}`}
                    </div>
                  </div>
                  {!used && !revoked && (
                    <button
                      type="button"
                      onClick={() => onRevokeInvite(invite)}
                      className="grid h-7 w-7 place-items-center rounded border border-destructive/40 text-destructive"
                      title="Revogar convite"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {invites.length === 0 && <li className="text-muted-foreground">Nenhum convite ativo.</li>}
        </ul>
      </section>
    </div>
  );
}

function BasesSection({
  bases,
  loading,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
  onDraft,
}: {
  bases: any[];
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  onUpdate: (base: any) => void;
  onDelete: (base: any) => void;
  onDraft: React.Dispatch<React.SetStateAction<any[]>>;
}) {
  return (
    <section className="rounded-md border border-border bg-surface">
      <SectionHeader
        icon={<Building2 className="h-4 w-4" />}
        title="Bases"
        subtitle="Bases operacionais, UF, coordenadas e cidades cobertas"
        action={
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Criar base
          </button>
        }
        loading={loading}
        onRefresh={onRefresh}
      />
      {loading ? (
        <LoadingState />
      ) : (
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          {bases.map((base) => (
            <article key={base.id} className="rounded-md border border-border bg-background p-3">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {base.id}
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-2">
                <input
                  value={base.name || ""}
                  onChange={(event) =>
                    updateBaseDraft(onDraft, base.id, { name: event.target.value })
                  }
                  className={inputClass}
                  placeholder="Nome"
                />
                <UfSelect
                  value={base.uf || "PE"}
                  onChange={(uf) => updateBaseDraft(onDraft, base.id, { uf })}
                />
                <input
                  value={base.city || ""}
                  onChange={(event) => {
                    const preset = findCityPreset(event.target.value, base.uf || "PE");
                    updateBaseDraft(onDraft, base.id, {
                      city: event.target.value,
                      ...(preset
                        ? {
                            latitude: base.latitude ?? preset.latitude,
                            longitude: base.longitude ?? preset.longitude,
                            coverage_cities_text:
                              base.coverage_cities_text || preset.coverage_cities.join(", "),
                          }
                        : {}),
                    });
                  }}
                  className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  placeholder="Cidade"
                />
                <input
                  value={base.latitude ?? ""}
                  onChange={(event) =>
                    updateBaseDraft(onDraft, base.id, { latitude: event.target.value })
                  }
                  placeholder="Latitude"
                  className={inputClass}
                />
                <input
                  value={base.longitude ?? ""}
                  onChange={(event) =>
                    updateBaseDraft(onDraft, base.id, { longitude: event.target.value })
                  }
                  placeholder="Longitude"
                  className={inputClass}
                />
                <textarea
                  value={
                    base.coverage_cities_text ??
                    (Array.isArray(base.coverage_cities) ? base.coverage_cities.join(", ") : "")
                  }
                  onChange={(event) =>
                    updateBaseDraft(onDraft, base.id, { coverage_cities_text: event.target.value })
                  }
                  placeholder="Cidades cobertas, separadas por virgula"
                  rows={3}
                  className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
                <button
                  onClick={() => onUpdate(base)}
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-primary/40 px-2 py-1.5 text-xs font-semibold text-primary"
                >
                  <Save className="h-3.5 w-3.5" /> Salvar
                </button>
                <button
                  onClick={() => onDelete(base)}
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-destructive/40 px-2 py-1.5 text-xs font-semibold text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              </div>
            </article>
          ))}
          {bases.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">Nenhuma base.</div>
          )}
        </div>
      )}
    </section>
  );
}

function InviteModal({
  open,
  bases,
  invite,
  createdCode,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  bases: any[];
  invite: any;
  createdCode: string;
  busy: boolean;
  onChange: (invite: any) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  if (!open) return null;
  return (
    <ModalFrame
      title="Criar convite"
      subtitle="Cadastro fechado por codigo unico"
      onClose={onClose}
    >
      {createdCode && (
        <div className="rounded-md border border-primary/40 bg-primary/10 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-primary">
            Codigo gerado
          </div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-background px-2 py-1 text-xs">
              {createdCode}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(createdCode)}
              className="grid h-8 w-8 place-items-center rounded border border-border text-muted-foreground hover:text-primary"
              title="Copiar convite"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Papel">
          <select
            value={invite.role}
            onChange={(event) => onChange({ ...invite, role: event.target.value })}
            className={inputClass}
          >
            <option value="operador">operador</option>
            <option value="comandante">comandante</option>
            <option value="admin">admin</option>
          </select>
        </Field>
        {invite.role === "operador" && (
          <Field label="Base do operador">
            <select
              required
              value={invite.base_id}
              onChange={(event) => onChange({ ...invite, base_id: event.target.value })}
              className={inputClass}
            >
              <option value="">Selecione...</option>
              {bases.map((base) => (
                <option key={base.id} value={base.id}>
                  {base.name || base.id}
                </option>
              ))}
            </select>
          </Field>
        )}
        {invite.role === "comandante" && (
          <Field label="UF do comandante">
            <UfSelect
              value={invite.uf_scope}
              onChange={(uf) => onChange({ ...invite, uf_scope: uf })}
              className="w-full"
            />
          </Field>
        )}
        <Field label="Validade em horas">
          <input
            type="number"
            min={1}
            max={720}
            value={invite.expires_in_hours}
            onChange={(event) =>
              onChange({ ...invite, expires_in_hours: Number(event.target.value) })
            }
            className={inputClass}
          />
        </Field>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Gerar convite
        </button>
      </form>
    </ModalFrame>
  );
}

function BaseModal({
  open,
  form,
  cityPreset,
  busy,
  onChange,
  onApplyPreset,
  onClose,
  onSubmit,
}: {
  open: boolean;
  form: ReturnType<typeof emptyBaseForm>;
  cityPreset?: (typeof CITY_PRESETS)[number];
  busy: boolean;
  onChange: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyBaseForm>>>;
  onApplyPreset: (preset: (typeof CITY_PRESETS)[number]) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  if (!open) return null;
  return (
    <ModalFrame
      title="Criar base"
      subtitle="Use uma cidade conhecida ou informe coordenadas manualmente"
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Cidade conhecida">
          <select
            value=""
            onChange={(event) => {
              const preset = CITY_PRESETS.find(
                (item) => `${item.city}:${item.uf}` === event.target.value,
              );
              if (preset) onApplyPreset(preset);
            }}
            className={inputClass}
          >
            <option value="">Selecionar sugestao...</option>
            {CITY_PRESETS.map((preset) => (
              <option key={`${preset.city}:${preset.uf}`} value={`${preset.city}:${preset.uf}`}>
                {preset.city} - {preset.uf}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="ID da base">
            <input
              required
              value={form.id}
              onChange={(event) => onChange((prev) => ({ ...prev, id: event.target.value }))}
              className={inputClass}
              placeholder="base-fortaleza"
            />
          </Field>
          <Field label="Nome">
            <input
              required
              value={form.name}
              onChange={(event) => onChange((prev) => ({ ...prev, name: event.target.value }))}
              className={inputClass}
              placeholder="Base Fortaleza"
            />
          </Field>
          <Field label="Cidade">
            <input
              required
              value={form.city}
              onChange={(event) => {
                const preset = findCityPreset(event.target.value, form.uf);
                onChange((prev) => ({
                  ...prev,
                  city: event.target.value,
                  ...(preset
                    ? {
                        uf: preset.uf,
                        latitude: String(preset.latitude),
                        longitude: String(preset.longitude),
                        coverage_cities: preset.coverage_cities.join(", "),
                      }
                    : {}),
                }));
              }}
              className={inputClass}
              placeholder="Fortaleza"
            />
          </Field>
          <Field label="UF">
            <UfSelect value={form.uf} onChange={(uf) => onChange((prev) => ({ ...prev, uf }))} />
          </Field>
          <Field label="Latitude">
            <input
              value={form.latitude}
              onChange={(event) => onChange((prev) => ({ ...prev, latitude: event.target.value }))}
              className={inputClass}
              placeholder="-3.7319"
            />
          </Field>
          <Field label="Longitude">
            <input
              value={form.longitude}
              onChange={(event) => onChange((prev) => ({ ...prev, longitude: event.target.value }))}
              className={inputClass}
              placeholder="-38.5267"
            />
          </Field>
        </div>
        <Field label="Cidades cobertas">
          <textarea
            value={form.coverage_cities}
            onChange={(event) =>
              onChange((prev) => ({ ...prev, coverage_cities: event.target.value }))
            }
            rows={3}
            className={inputClass}
            placeholder="Fortaleza, Caucaia, Maracanau..."
          />
        </Field>
        {cityPreset && (
          <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
            Sugestao local encontrada para {cityPreset.city}. Coordenadas e cobertura podem ser
            preenchidas automaticamente.
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Criar base
        </button>
      </form>
    </ModalFrame>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  action,
  loading,
  onRefresh,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="text-primary">{icon}</div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {subtitle}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {action}
        <button
          onClick={onRefresh}
          className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
          title="Atualizar"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}

function ModalFrame({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <section className="w-full max-w-xl rounded-md border border-border bg-surface shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {subtitle}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded border border-border text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-3 p-4">{children}</div>
      </section>
    </div>
  );
}

const inputClass = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs";

function UfSelect({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value || "PE"}
      onChange={(event) => onChange(event.target.value)}
      className={`rounded-md border border-border bg-background px-2 py-1.5 text-xs ${className}`}
    >
      {UFS.map((uf) => (
        <option key={uf} value={uf}>
          {uf}
        </option>
      ))}
    </select>
  );
}

function PanelTitle({
  icon,
  title,
  subtitle,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon && <div className="text-primary">{icon}</div>}
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid place-items-center p-6 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function updateBaseDraft(
  setBases: React.Dispatch<React.SetStateAction<any[]>>,
  id: string,
  patch: Record<string, unknown>,
) {
  setBases((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
}

function emptyBaseForm() {
  return {
    id: "",
    name: "",
    city: "",
    uf: "PE",
    latitude: "",
    longitude: "",
    coverage_cities: "",
  };
}

function parseCities(input: string | string[]) {
  const raw = Array.isArray(input) ? input.join(",") : input;
  return raw
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalNumber(input: unknown) {
  if (input === undefined || input === null || input === "") return null;
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function findCityPreset(city: string, uf?: string) {
  const normalizedCity = normalizeSlug(city);
  const normalizedUf = (uf || "").toUpperCase();
  return CITY_PRESETS.find(
    (preset) =>
      normalizeSlug(preset.city) === normalizedCity &&
      (!normalizedUf || preset.uf === normalizedUf),
  );
}

function getSection(search: any): AdminSection {
  if (typeof search === "string") {
    return new URLSearchParams(search).get("section") === "bases" ? "bases" : "users";
  }
  return search?.section === "bases" ? "bases" : "users";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
