import type { RouteRecordRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable without signing in. */
    public?: boolean
  }
}

// Screen ids (1a–1m) refer to the screen design (see docs/spec.md).
export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true },
  },
  // Not in the design: the terms of service and privacy policy
  {
    path: '/terms',
    name: 'terms',
    component: () => import('../views/LegalView.vue'),
    props: { kind: 'terms' },
    meta: { public: true },
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: () => import('../views/LegalView.vue'),
    props: { kind: 'privacy' },
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
  // Not in the design: profile, masters, CSV export, withdrawal
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
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
