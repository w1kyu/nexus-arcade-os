/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.tasks',
  name: { en: 'Tasks', de: 'Aufgaben' },
  description: {
    en: 'Projects, Kanban boards, bilingual quick add, recurring tasks and productivity stats',
    de: 'Projekte, Kanban-Boards, zweisprachige Schnelleingabe, wiederkehrende Aufgaben und Statistiken',
  },
  version: '1.0.0',
  icon: 'checklist',
  category: 'productivity',
  keywords: ['tasks', 'todo', 'kanban', 'projects', 'gtd', 'aufgaben', 'liste'],
  window: { width: 1020, height: 660, minWidth: 500, minHeight: 360, singleInstance: true },
  permissions: ['vfs', 'intents', 'notifications', 'scheduler'],
  handles: [{ action: 'share', types: ['text/plain', 'application/vnd.nexus.task'] }],
  storage: {
    version: 1,
    collections: {
      tasks: {
        indexes: {
          projectId: 'projectId',
          dueDate: 'dueDate',
          completed: 'completed',
          tags: { keyPath: 'tags', multiEntry: true },
        },
      },
      projects: {
        indexes: {
          createdAt: 'createdAt',
        },
      },
      filters: {},
    },
  },
  commands: [
    { id: 'tasks.new', title: { en: 'New task', de: 'Neue Aufgabe' }, icon: 'checklist', shortcut: 'Mod+Alt+K' },
  ],
  terminal: [
    {
      name: 'tasks',
      description: { en: 'List or add tasks', de: 'Aufgaben auflisten oder hinzufügen' },
      usage: 'tasks [list | add <text> | done <id>]',
    },
  ],
  widgets: [
    {
      id: 'today',
      title: { en: "Today's tasks", de: 'Heutige Aufgaben' },
      icon: 'checklist',
      size: [2, 2],
      minSize: [2, 2],
      load: () => import('./widget.js'),
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
