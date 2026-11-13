// @ts-check
// OS Tools exposed to AI models for tool calling (Notes, Tasks, Calendar, Focus, Apps, System).

/**
 * @typedef {object} ToolDeclaration
 * @property {string} name
 * @property {string} description
 * @property {boolean} isReadOnly
 * @property {object} parameters  JSON schema
 */

/** @type {ToolDeclaration[]} */
export const TOOL_DECLARATIONS = [
  {
    name: 'create_note',
    description: 'Create a new markdown note in the user notes folder',
    isReadOnly: false,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the note (will be used as filename)' },
        content: { type: 'string', description: 'Markdown content of the note' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags for categorization' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'append_to_note',
    description: 'Append text to an existing note file in Notes',
    isReadOnly: false,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the note file (e.g. /Notes/Ideas.md)' },
        content: { type: 'string', description: 'Content to append to the note' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'search_notes',
    description: 'Search for notes containing specific text or keywords (read-only)',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword or search phrase to look for in notes' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task in Tasks',
    isReadOnly: false,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title or description of the task' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority level' },
        dueDate: { type: 'string', description: 'Optional due date in YYYY-MM-DD format' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_today_tasks',
    description: 'List pending tasks scheduled for today (read-only)',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_calendar_event',
    description: 'Create an event in the Calendar',
    isReadOnly: false,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the event' },
        date: { type: 'string', description: 'Event date in YYYY-MM-DD format' },
        time: { type: 'string', description: 'Event time in HH:MM format (optional)' },
        duration: { type: 'number', description: 'Duration in minutes (default 60)' },
      },
      required: ['title', 'date'],
    },
  },
  {
    name: 'start_focus_session',
    description: 'Start a Pomodoro or focus timer session',
    isReadOnly: false,
    parameters: {
      type: 'object',
      properties: {
        durationMinutes: { type: 'number', description: 'Duration of focus session in minutes (e.g. 25)' },
        taskTitle: { type: 'string', description: 'Name of the task to focus on' },
      },
    },
  },
  {
    name: 'open_app',
    description: 'Launch an application in Nexus Arcade OS',
    isReadOnly: false,
    parameters: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'ID of the app (e.g. nexus.notes, nexus.code, nexus.terminal)' },
      },
      required: ['appId'],
    },
  },
  {
    name: 'set_theme_or_wallpaper',
    description: 'Change the system theme or wallpaper',
    isReadOnly: false,
    parameters: {
      type: 'object',
      properties: {
        theme: { type: 'string', description: 'Theme id (e.g. dark, light, arcade, cyber, sepia)' },
        wallpaper: { type: 'string', description: 'Wallpaper name' },
      },
    },
  },
  {
    name: 'create_flashcards',
    description: 'Create a deck of study flashcards in Flashcards app',
    isReadOnly: false,
    parameters: {
      type: 'object',
      properties: {
        deck: { type: 'string', description: 'Name of the deck' },
        cards: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              front: { type: 'string', description: 'Question or prompt' },
              back: { type: 'string', description: 'Answer or explanation' },
            },
            required: ['front', 'back'],
          },
          description: 'List of flashcards to add',
        },
      },
      required: ['deck', 'cards'],
    },
  },
];

/**
 * Returns OpenAI-format tool definitions for chat completions.
 */
export function getOpenAiToolDefinitions() {
  return TOOL_DECLARATIONS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/**
 * Formats a user-facing summary of the proposed action for confirmation.
 * @param {string} toolName
 * @param {any} args
 * @returns {{ title: string, summary: string, details: string, isReadOnly: boolean }}
 */
export function formatToolConfirmation(toolName, args) {
  const decl = TOOL_DECLARATIONS.find((t) => t.name === toolName);
  const isReadOnly = decl?.isReadOnly ?? false;

  switch (toolName) {
    case 'create_note':
      return {
        title: 'Create Note',
        summary: `Create note "${args.title || 'Untitled'}"`,
        details: `Content length: ${(args.content || '').length} characters${args.tags?.length ? ` · Tags: ${args.tags.join(', ')}` : ''}`,
        isReadOnly,
      };
    case 'append_to_note':
      return {
        title: 'Append to Note',
        summary: `Append to note at ${args.path}`,
        details: `Appending ${(args.content || '').length} characters`,
        isReadOnly,
      };
    case 'search_notes':
      return {
        title: 'Search Notes',
        summary: `Search notes for "${args.query}"`,
        details: 'Read-only search query across VFS notes folder',
        isReadOnly,
      };
    case 'create_task':
      return {
        title: 'Create Task',
        summary: `Add task "${args.title}"`,
        details: `Priority: ${args.priority || 'normal'}${args.dueDate ? ` · Due: ${args.dueDate}` : ''}`,
        isReadOnly,
      };
    case 'list_today_tasks':
      return {
        title: 'List Tasks',
        summary: 'List today’s tasks',
        details: 'Read-only query of scheduled tasks',
        isReadOnly,
      };
    case 'create_calendar_event':
      return {
        title: 'Create Event',
        summary: `Add event "${args.title}" on ${args.date}`,
        details: `${args.time ? `At ${args.time}` : 'All day'}${args.duration ? ` · ${args.duration} min` : ''}`,
        isReadOnly,
      };
    case 'start_focus_session':
      return {
        title: 'Start Focus Session',
        summary: `Start ${args.durationMinutes || 25}-minute focus session`,
        details: args.taskTitle ? `Task: ${args.taskTitle}` : 'General focus',
        isReadOnly,
      };
    case 'open_app':
      return {
        title: 'Open App',
        summary: `Launch app "${args.appId}"`,
        details: 'Opens application window',
        isReadOnly,
      };
    case 'set_theme_or_wallpaper':
      return {
        title: 'Change Appearance',
        summary: 'Change theme or wallpaper',
        details: `${args.theme ? `Theme: ${args.theme}` : ''}${args.wallpaper ? ` · Wallpaper: ${args.wallpaper}` : ''}`,
        isReadOnly,
      };
    case 'create_flashcards':
      return {
        title: 'Create Flashcards',
        summary: `Add ${(args.cards || []).length} cards to deck "${args.deck}"`,
        details: `Creates study flashcard deck in Flashcards`,
        isReadOnly,
      };
    default:
      return {
        title: `Execute ${toolName}`,
        summary: `Execute action ${toolName}`,
        details: JSON.stringify(args, null, 2),
        isReadOnly,
      };
  }
}

/**
 * Executes an OS tool call using AppContext.
 * @param {import('../../kernel/types').AppContext} ctx
 * @param {string} toolName
 * @param {any} args
 * @returns {Promise<{ success: boolean, output: string, data?: any }>}
 */
export async function executeToolCall(ctx, toolName, args) {
  /** @type {any} */
  const fs = ctx.fs;
  try {
    switch (toolName) {
      case 'create_note': {
        const root = '/Notes';
        if (fs) {
          if (!(await fs.exists(root))) {
            await fs.createFolder(root).catch(() => {});
          }
          const filename = `${(args.title || 'Untitled').replace(/[\\/:*?"<>|]/g, '_')}.md`;
          const filePath = `${root}/${filename}`;
          const uniquePath = await fs.uniquePath(filePath);
          const header = `---\ntags: ${JSON.stringify(args.tags || [])}\ncreated: ${new Date().toISOString()}\n---\n\n`;
          await fs.writeFile(uniquePath, header + (args.content || ''));
          return {
            success: true,
            output: `Note created successfully at ${uniquePath}`,
            data: { path: uniquePath },
          };
        }
        return { success: false, output: 'VFS is not available' };
      }

      case 'append_to_note': {
        if (fs) {
          const path = args.path;
          if (!(await fs.exists(path))) {
            return { success: false, output: `Note at ${path} does not exist` };
          }
          const existing = await fs.readFile(path, { as: 'text' });
          await fs.writeFile(path, `${existing}\n\n${args.content}`);
          return { success: true, output: `Content appended to ${path}` };
        }
        return { success: false, output: 'VFS is not available' };
      }

      case 'search_notes': {
        if (fs) {
          const root = '/Notes';
          if (!(await fs.exists(root))) {
            return { success: true, output: 'No notes folder found' };
          }
          const nodes = /** @type {any[]} */ (await fs.walk(root));
          const query = String(args.query || '').toLowerCase();
          const matches = [];
          for (const node of nodes) {
            if (node.type === 'file' && node.name.endsWith('.md')) {
              const text = await fs.readFile(node.path, { as: 'text' });
              if (node.name.toLowerCase().includes(query) || text.toLowerCase().includes(query)) {
                matches.push({ path: node.path, name: node.name });
              }
            }
          }
          return {
            success: true,
            output: `Found ${matches.length} matching note(s): ${matches.map((m) => m.path).join(', ') || 'None'}`,
            data: matches,
          };
        }
        return { success: false, output: 'VFS is not available' };
      }

      case 'create_task': {
        // Broadcast task creation or write to config snapshot
        ctx.events.emit('tasks:create-from-note', {
          title: args.title,
          priority: args.priority || 'medium',
          dueDate: args.dueDate,
        });
        return {
          success: true,
          output: `Task "${args.title}" created successfully`,
        };
      }

      case 'list_today_tasks': {
        if (fs && (await fs.exists('~/.config/tasks-snapshot.json'))) {
          try {
            const raw = await fs.readFile('~/.config/tasks-snapshot.json', { as: 'text' });
            const snapshot = JSON.parse(raw);
            const tasks = snapshot.tasks || [];
            return {
              success: true,
              output: `Tasks found (${tasks.length}): ${tasks.map((/** @type {any} */ t) => `[${t.done ? 'x' : ' '}] ${t.title}`).join('; ') || 'No tasks'}`,
              data: tasks,
            };
          } catch {
            //
          }
        }
        return { success: true, output: 'No scheduled tasks found for today.' };
      }

      case 'create_calendar_event': {
        ctx.events.emit('calendar:add-event', {
          title: args.title,
          date: args.date,
          time: args.time,
          duration: args.duration || 60,
        });
        return {
          success: true,
          output: `Calendar event "${args.title}" created for ${args.date}`,
        };
      }

      case 'start_focus_session': {
        const mins = Number(args.durationMinutes) || 25;
        ctx.events.emit('focus:start', { duration: mins, task: args.taskTitle });
        if (ctx.commands) {
          ctx.commands.execute('shell.launchApp', { appId: 'nexus.focus' }).catch(() => {});
        }
        return {
          success: true,
          output: `Started ${mins}-minute focus session${args.taskTitle ? ` for "${args.taskTitle}"` : ''}`,
        };
      }

      case 'open_app': {
        if (ctx.commands) {
          await ctx.commands.execute('shell.launchApp', { appId: args.appId });
          return { success: true, output: `Application ${args.appId} opened` };
        }
        return { success: false, output: 'Commands API is not available' };
      }

      case 'set_theme_or_wallpaper': {
        if (args.theme && ctx.settings) {
          await ctx.settings.set('theme', args.theme);
        }
        if (args.wallpaper && ctx.settings) {
          await ctx.settings.set('wallpaper', args.wallpaper);
        }
        return { success: true, output: 'Appearance settings updated' };
      }

      case 'create_flashcards': {
        ctx.events.emit('flashcards:import-deck', {
          title: args.deck,
          cards: args.cards,
        });
        return {
          success: true,
          output: `Flashcard deck "${args.deck}" created with ${(args.cards || []).length} cards`,
        };
      }

      default:
        return { success: false, output: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    const error = /** @type {Error} */ (err);
    return { success: false, output: `Tool execution failed: ${error.message}` };
  }
}
