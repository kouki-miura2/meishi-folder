import type { RouteRecordRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable without signing in. */
    public?: boolean
  }
}

// Screen ids (1a–1m) refer to the design in docs/spec/.
export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true },
  },
  // 1a
  { path: '/welcome', name: 'welcome', component: () => import('../views/WelcomeView.vue') },
  // 1b, 1c
  { path: '/', name: 'cards', component: () => import('../views/CardListView.vue') },
  // 1d–1g
  {
    path: '/cards/new',
    name: 'card-new',
    component: () => import('../views/CardRegisterView.vue'),
  },
  // 1h, 1j
  {
    path: '/cards/:id',
    name: 'card',
    component: () => import('../views/CardDetailView.vue'),
    props: true,
  },
  // 1i
  {
    path: '/cards/:id/edit',
    name: 'card-edit',
    component: () => import('../views/CardEditView.vue'),
    props: true,
  },
  // 1k, 1l
  {
    path: '/settings/companies',
    name: 'companies',
    component: () => import('../views/CompanySettingsView.vue'),
  },
  // 1m
  {
    path: '/settings/companies/:companyId/departments',
    name: 'departments',
    component: () => import('../views/DepartmentSettingsView.vue'),
    props: true,
  },
]
