import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { AuthProvider } from "../lib/auth";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background text-foreground">
      <div className="text-center">
        <div className="text-5xl font-bold text-primary">404</div>
        <div className="mt-2 text-sm text-muted-foreground">Rota nao encontrada</div>
        <a
          href="/"
          className="mt-4 inline-block rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
        >
          Ir para o cockpit
        </a>
      </div>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    </QueryClientProvider>
  );
}
