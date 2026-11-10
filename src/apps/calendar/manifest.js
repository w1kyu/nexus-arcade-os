// @ts-check
/** @type {import('../../kernel/types').AppManifest} */
export default {
  id: 'nexus.calendar',
  name: { en: 'Calendar', de: 'Kalender' },
  description: {
    en: 'Day, week, month, year, and agenda calendar with .ics import/export, German holidays, and task overlays',
    de: 'Tag-, Wochen-, Monats-, Jahres- und Agendakalender mit .ics-Import/Export, Feiertagen und Aufgaben-Overlay',
  },
  version: '1.0.0',
  icon: 'calendar',
  category: 'productivity',
  keywords: ['calendar', 'events', 'schedule', 'ics', 'holidays', 'kalender', 'termine', 'feiertage'],
  window: { width: 1080, height: 700, minWidth: 640, minHeight: 440, singleInstance: true },
  permissions: ['vfs', 'intents', 'notifications', 'scheduler', 'clipboard'],
  handles: [
    {
      action: 'open',
      types: ['.ics', 'text/calendar'],
    },
  ],
  storage: {
    version: 1,
    collections: {
      events: {
        indexes: {
          calendarId: 'calendarId',
          startDate: 'startDate',
        },
      },
      calendars: {
        indexes: {
          name: 'name',
        },
      },
    },
  },
  settings: [
    {
      key: 'weekStart',
      label: { en: 'First day of week', de: 'Wochenbeginn' },
      type: 'enum',
      options: [
        { value: 'monday', label: { en: 'Monday', de: 'Montag' } },
        { value: 'sunday', label: { en: 'Sunday', de: 'Sonntag' } },
      ],
      default: 'monday',
    },
    {
      key: 'holidayState',
      label: { en: 'German Federal State for Holidays', de: 'Bundesland für Feiertage' },
      type: 'enum',
      options: [
        { value: 'HE', label: { en: 'Hesse (HE)', de: 'Hessen (HE)' } },
        { value: 'BW', label: { en: 'Baden-Württemberg (BW)', de: 'Baden-Württemberg (BW)' } },
        { value: 'BY', label: { en: 'Bavaria (BY)', de: 'Bayern (BY)' } },
        { value: 'BE', label: { en: 'Berlin (BE)', de: 'Berlin (BE)' } },
        { value: 'NW', label: { en: 'North Rhine-Westphalia (NW)', de: 'Nordrhein-Westfalen (NW)' } },
        { value: 'HH', label: { en: 'Hamburg (HH)', de: 'Hamburg (HH)' } },
        { value: 'SN', label: { en: 'Saxony (SN)', de: 'Sachsen (SN)' } },
      ],
      default: 'HE',
    },
  ],
  commands: [
    {
      id: 'calendar.newEvent',
      title: { en: 'New calendar event', de: 'Neuer Kalendertermin' },
      icon: 'calendar',
      shortcut: 'Mod+Alt+C',
    },
  ],
  terminal: [
    {
      name: 'cal-events',
      description: {
        en: 'Show upcoming calendar events or add an event',
        de: 'Kommende Termine anzeigen oder hinzufügen',
      },
      usage: 'cal-events [agenda | add <text>]',
    },
  ],
  messages: { en: () => import('./i18n/en.json'), de: () => import('./i18n/de.json') },
  help: () => import('./help.md?raw'),
  changelog: () => import('./changelog.md?raw'),
  screenshots: () => import('./screenshots/index.js'),
  load: () => import('./index.js'),
};
