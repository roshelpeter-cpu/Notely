import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDb, getDb, resetDatabase } from './db.js';
import { loadEnv } from './env.js';
import { migrate } from './db.js';
import { addLink, createNote, openDailyNote, trashNote, updateNote } from './repo/notes.js';
import {
  createFolder,
  createNotebook,
  createTag,
  createWorkspace,
  listWorkspaces,
  updateProfile,
  updateWorkspace,
} from './repo/organise.js';
import { ensureFoundation } from './repo/shared.js';
import { createTask } from './repo/tasks.js';
import { localDate } from './util.js';

function daysAgo(amount, hour = 9) {
  const date = new Date();
  date.setHours(hour, 20, 0, 0);
  date.setDate(date.getDate() - amount);
  return { at: date.toISOString(), on: localDate(date) };
}

function text(value) {
  return { type: 'text', text: value };
}

function paragraph(value) {
  return { type: 'paragraph', content: value ? [text(value)] : [] };
}

function heading(level, value) {
  return { type: 'heading', attrs: { level }, content: [text(value)] };
}

function bullets(items) {
  return {
    type: 'bulletList',
    content: items.map((item) => ({ type: 'listItem', content: [paragraph(item)] })),
  };
}

function checks(items) {
  return {
    type: 'taskList',
    content: items.map(([checked, item]) => ({
      type: 'taskItem',
      attrs: { checked },
      content: [paragraph(item)],
    })),
  };
}

function quote(value) {
  return { type: 'blockquote', content: [paragraph(value)] };
}

function code(value) {
  return { type: 'codeBlock', attrs: { language: null }, content: [text(value)] };
}

function doc(...nodes) {
  return { type: 'doc', content: nodes };
}

export function seed() {
  ensureFoundation();
  updateProfile({
    displayName: 'Roshel',
    tagline: 'Keeper of a quiet woodland library',
  });

  const personal = listWorkspaces().find((workspace) => workspace.isDefault);
  updateWorkspace(personal.id, {
    name: 'Personal',
    description: 'Field notes, projects, and the long way home.',
    isDefault: true,
  });
  const study = createWorkspace({
    name: 'Study',
    description: 'Internship work, systems, and careful reading.',
  });

  const life = createFolder({ workspaceId: personal.id, name: 'Life' });
  const semester = createFolder({ workspaceId: study.id, name: 'Semester' });

  const field = createNotebook({
    workspaceId: personal.id,
    folderId: life.id,
    name: 'Field Journal',
    description: 'Walks, weather, and things noticed slowly.',
    color: 'sage',
    cover: 'floral',
  });
  const cottage = createNotebook({
    workspaceId: personal.id,
    name: 'Cottage Projects',
    description: 'Benches, shelves, and small repairs.',
    color: 'bark',
    cover: 'cottage',
  });
  const ideas = createNotebook({
    workspaceId: personal.id,
    name: 'Ideas',
    description: 'Sparks that are not ready to be plans.',
    color: 'gold',
    cover: 'lantern',
  });
  const reading = createNotebook({
    workspaceId: personal.id,
    name: 'Reading',
    description: 'Margins, questions, and passages to return to.',
    color: 'dusk',
    cover: 'moon',
  });
  const internship = createNotebook({
    workspaceId: study.id,
    folderId: semester.id,
    name: 'Internship',
    description: 'The work of showing how the work was done.',
    color: 'forest',
    cover: 'river',
  });
  const systems = createNotebook({
    workspaceId: study.id,
    folderId: semester.id,
    name: 'System Design',
    description: 'Quiet structures for finding things again.',
    color: 'moss',
    cover: 'fern',
  });

  const tags = {
    learning: createTag({ workspaceId: study.id, name: 'Learning', color: 'moss' }),
    career: createTag({ workspaceId: study.id, name: 'Career', color: 'gold' }),
    ux: createTag({ workspaceId: personal.id, name: 'UX', color: 'rose' }),
    uxStudy: createTag({ workspaceId: study.id, name: 'UX', color: 'rose' }),
    projects: createTag({ workspaceId: personal.id, name: 'Projects', color: 'bark' }),
    personal: createTag({ workspaceId: personal.id, name: 'Personal', color: 'forest' }),
    systems: createTag({ workspaceId: study.id, name: 'Systems', color: 'sky' }),
    reading: createTag({ workspaceId: personal.id, name: 'Reading', color: 'dusk' }),
  };

  const willow = createNote(
    {
      workspaceId: personal.id,
      notebookId: field.id,
      title: 'Willow path, early light',
      color: 'sage',
      isFavourite: true,
      tagIds: [tags.personal.id],
      contentJson: doc(
        heading(2, 'What the morning held'),
        paragraph('The path by the willows was still wet, and the footbridge held a ribbon of mist. I walked slowly enough to hear the river under it.'),
        bullets(['Three herons on the far bank', 'A new crack in the bridge rail', 'Wild mint near the second post']),
        paragraph('This belongs with the bench notes. The same timber, the same patience.'),
      ),
    },
    daysAgo(4, 8),
  );

  const bench = createNote(
    {
      workspaceId: personal.id,
      notebookId: cottage.id,
      title: 'Cedar bench joints',
      color: 'gold',
      tagIds: [tags.projects.id],
      contentJson: doc(
        heading(2, 'A seat for the porch'),
        paragraph('The cedar is pale and straight. I want a bench that can live outside without looking like garden furniture from a catalogue.'),
        bullets(['Through-tenons at the arms', 'A gentle curve on the back slats', 'Oil, not varnish']),
        paragraph('Measure twice beside the willow sketches. The porch is shallower than I remember.'),
      ),
    },
    daysAgo(3, 16),
  );

  const intentions = createNote(
    {
      workspaceId: personal.id,
      notebookId: ideas.id,
      title: 'November intentions',
      color: 'parchment',
      isPinned: true,
      tagIds: [tags.personal.id, tags.projects.id],
      contentJson: doc(
        heading(2, 'Keep the month small'),
        checks([
          [true, 'Write in the field journal four mornings'],
          [false, 'Finish the portfolio case study'],
          [false, 'Mend the porch bench before the rain turns'],
        ]),
        paragraph('A good month is one I can remember without opening a spreadsheet.'),
      ),
    },
    daysAgo(2, 10),
  );

  const review = createNote(
    {
      workspaceId: personal.id,
      notebookId: ideas.id,
      title: 'Weekly review',
      color: 'sky',
      tagIds: [tags.personal.id],
      contentJson: doc(
        heading(2, 'What moved'),
        paragraph('The internship outline finally has a shape. The bench is still a drawing. I read more than I wrote, which is allowed.'),
        heading(2, 'What to carry forward'),
        bullets(['Protect two quiet mornings', 'Link the case study back to the search notes', 'Leave the lantern sketches untitled until they earn a name']),
      ),
    },
    daysAgo(1, 18),
  );

  const essay = createNote(
    {
      workspaceId: personal.id,
      notebookId: reading.id,
      title: 'Margins on a paper library',
      color: 'dusk',
      isFavourite: true,
      tagIds: [tags.reading.id, tags.ux.id],
      contentJson: doc(
        quote('A library is a room that remembers how you moved through it.'),
        paragraph('I am writing this as a personal essay, not as notes on someone else\'s book. The idea is that search should feel like walking between shelves, not like interrogating a box.'),
        paragraph('Related to the quiet-search notes in Study. The interface can be precise and still have a sense of place.'),
      ),
    },
    daysAgo(5, 20),
  );

  const rooms = createNote(
    {
      workspaceId: personal.id,
      notebookId: ideas.id,
      title: 'Interfaces that feel like rooms',
      color: 'rose',
      tagIds: [tags.ux.id],
      contentJson: doc(
        heading(2, 'A room has edges'),
        paragraph('People relax when they can tell where they are. A note should have a desk, a window, and a way back to the hall.'),
        bullets(['One primary action in view', 'Navigation that stays put', 'Empty states that explain the next kind step']),
        paragraph('This is the thread that ties the portfolio case study to the system design notes.'),
      ),
    },
    daysAgo(1, 11),
  );

  const plan = createNote(
    {
      workspaceId: study.id,
      notebookId: internship.id,
      title: 'Internship plan',
      color: 'moss',
      isPinned: true,
      tagIds: [tags.career.id, tags.learning.id],
      contentJson: doc(
        heading(2, 'Objectives'),
        bullets([
          'Show a complete case study from question to interface',
          'Keep a readable record of decisions',
          'Leave the repository understandable to another person',
        ]),
        heading(2, 'This week'),
        checks([
          [true, 'Collect the screens that explain the woodland library'],
          [false, 'Write the case study narrative'],
          [false, 'Prepare the README a reviewer can follow'],
        ]),
      ),
    },
    daysAgo(6, 9),
  );

  const planMiddle = doc(
    heading(2, 'Objectives'),
    bullets([
      'Show a complete case study from question to interface',
      'Keep a readable record of decisions',
      'Leave the repository understandable to another person',
    ]),
    heading(2, 'This week'),
    checks([
      [true, 'Collect the screens that explain the woodland library'],
      [false, 'Write the case study narrative'],
      [false, 'Prepare the README a reviewer can follow'],
    ]),
    paragraph('Added after the first review: the case study should open with the feeling of arrival, then show the work underneath it. A portfolio can be warm without being vague.'),
  );
  updateNote(plan.id, { contentJson: planMiddle });
  updateNote(plan.id, {
    contentJson: doc(
      ...planMiddle.content,
      paragraph('Second pass: name the constraints. Local only, no paid services, and every number on the dashboard has to come from a real record.'),
    ),
  });

  const portfolio = createNote(
    {
      workspaceId: study.id,
      notebookId: internship.id,
      title: 'Portfolio case study',
      color: 'gold',
      tagIds: [tags.career.id, tags.uxStudy.id],
      contentJson: doc(
        heading(2, 'Story'),
        paragraph('Notely is a personal knowledge workspace that feels like entering a woodland village. The case study has to prove the engineering, not only the scenery.'),
        heading(2, 'Evidence'),
        bullets(['Day and night are two complete environments', 'Notes, tasks, and links share one database', 'The reader can run it locally']),
      ),
    },
    daysAgo(2, 14),
  );

  const career = createNote(
    {
      workspaceId: study.id,
      notebookId: internship.id,
      title: 'Questions for the next conversation',
      color: 'parchment',
      tagIds: [tags.career.id],
      contentJson: doc(
        paragraph('What kind of work lets me care about both the structure and the atmosphere?'),
        bullets([
          'Ask how design critiques are held',
          'Bring one system diagram, not ten screens',
          'Be ready to explain a tradeoff without apologising for it',
        ]),
      ),
    },
    daysAgo(3, 12),
  );

  const search = createNote(
    {
      workspaceId: study.id,
      notebookId: systems.id,
      title: 'Quiet search',
      color: 'sky',
      tagIds: [tags.systems.id, tags.learning.id],
      contentJson: doc(
        heading(2, 'A search that does not shout'),
        paragraph('Full-text search should find a sentence I half remember. Filters should narrow the shelves, not replace them.'),
        code('MATCH title, content\nFILTER notebook, tag, date, pinned'),
        paragraph('Related notes can be suggested from shared words. Say that plainly. Do not pretend a model is in the room.'),
      ),
    },
    daysAgo(4, 15),
  );

  const mapNote = createNote(
    {
      workspaceId: study.id,
      notebookId: systems.id,
      title: 'Map of the study',
      color: 'moss',
      tagIds: [tags.systems.id],
      contentJson: doc(
        paragraph('The internship plan points at the case study. The case study points at the interface notes. Search sits underneath both, because nothing is useful if it cannot be found again.'),
        paragraph('The knowledge map should be a working view of those links, not a picture of a map.'),
      ),
    },
    daysAgo(0, 9),
  );

  createNote(
    {
      workspaceId: personal.id,
      title: 'Question for later',
      color: 'slate',
      contentJson: doc(paragraph('Where should unfinished thoughts live before they deserve a notebook?')),
    },
    daysAgo(2, 8),
  );
  createNote(
    {
      workspaceId: personal.id,
      notebookId: ideas.id,
      title: 'Lantern sketch',
      color: 'gold',
      tagIds: [tags.projects.id],
      contentJson: doc(paragraph('A small brass lantern for the night theme. Warm, not neon.')),
    },
    daysAgo(1, 8),
  );
  createNote(
    {
      workspaceId: personal.id,
      notebookId: cottage.id,
      title: 'Lantern sketch',
      color: 'gold',
      contentJson: doc(paragraph('The same title, a different drawing: glass panels and a low flame.')),
    },
    daysAgo(0, 12),
  );

  const archived = createNote(
    {
      workspaceId: personal.id,
      notebookId: field.id,
      title: 'Old packing list',
      color: 'slate',
      contentJson: doc(bullets(['Notebook', 'Pencil', 'Thermos', 'A dry pair of socks'])),
    },
    daysAgo(20, 8),
  );
  updateNote(archived.id, { isArchived: true });

  const scratch = createNote(
    {
      workspaceId: personal.id,
      title: 'Scratch to clear',
      color: 'rose',
      contentJson: doc(paragraph('This was a false start and can leave the library.')),
    },
    daysAgo(8, 8),
  );
  trashNote(scratch.id);

  const today = openDailyNote({ workspaceId: personal.id, date: localDate() });
  updateNote(today.id, {
    contentJson: doc(
      heading(2, "Today's thoughts"),
      paragraph('The village is bright this morning. I want the case study to feel as calm as the path, and as carefully made as the bridge.'),
      heading(2, 'Daily goals'),
      checks([
        [false, 'Advance the portfolio narrative'],
        [false, 'Check the tasks that are actually due'],
        [true, 'Open the field journal'],
      ]),
      heading(2, 'Reflection'),
      paragraph('Leave one sentence for the evening. The day does not need to be finished at noon.'),
    ),
  });

  addLink(plan.id, portfolio.id);
  addLink(plan.id, career.id);
  addLink(search.id, mapNote.id);
  addLink(mapNote.id, plan.id);
  addLink(review.id, intentions.id);
  addLink(today.id, intentions.id);
  addLink(willow.id, bench.id);
  addLink(essay.id, rooms.id);

  const due = (offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return localDate(date);
  };

  createTask({
    workspaceId: study.id,
    noteId: portfolio.id,
    title: 'Finish the portfolio case study',
    description: 'Open with arrival, then show the system underneath.',
    status: 'in_progress',
    priority: 'high',
    dueDate: due(0),
    tagIds: [tags.career.id],
  });
  createTask({
    workspaceId: personal.id,
    noteId: today.id,
    title: 'Write the evening reflection',
    description: 'A few honest lines in the daily note.',
    status: 'pending',
    priority: 'medium',
    dueDate: due(0),
    tagIds: [tags.personal.id],
  });
  createTask({
    workspaceId: study.id,
    noteId: search.id,
    title: 'Review the quiet-search notes',
    description: 'Check that the filters match the writing.',
    status: 'pending',
    priority: 'medium',
    dueDate: due(1),
    tagIds: [tags.systems.id],
  });
  createTask({
    workspaceId: personal.id,
    noteId: bench.id,
    title: 'Sketch the cedar bench joints',
    description: 'Tenons, slats, and the real porch depth.',
    status: 'pending',
    priority: 'low',
    dueDate: due(3),
    tagIds: [tags.projects.id],
  });
  createTask({
    workspaceId: personal.id,
    noteId: essay.id,
    title: 'Organise the reading tags',
    description: 'Keep reading notes from wandering into project notes.',
    status: 'pending',
    priority: 'low',
    tagIds: [tags.reading.id],
  });
  createTask({
    workspaceId: study.id,
    noteId: plan.id,
    title: 'Prepare the internship README section',
    description: 'Another person should be able to run the project from the document.',
    status: 'pending',
    priority: 'high',
    dueDate: due(4),
    tagIds: [tags.career.id, tags.learning.id],
  });
  createTask(
    {
      workspaceId: personal.id,
      noteId: review.id,
      title: 'File last week\'s review',
      description: 'It is written. It only needed to be marked done.',
      status: 'completed',
      priority: 'low',
      dueDate: due(-1),
    },
    daysAgo(1, 19),
  );
  createTask(
    {
      workspaceId: personal.id,
      title: 'Watercolour the cottage cover',
      description: 'A small study for the notebook cloth.',
      status: 'completed',
      priority: 'medium',
      dueDate: due(-2),
      tagIds: [tags.projects.id],
    },
    daysAgo(2, 17),
  );

  return { personalId: personal.id, studyId: study.id };
}

export function seedIfEmpty() {
  migrate();
  if (getDb().prepare('SELECT id FROM profile WHERE id = 1').get()) return false;
  seed();
  return true;
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirect) {
  loadEnv();
  const reset = process.argv.includes('--reset');
  if (reset) {
    resetDatabase();
    seed();
    console.log('Replaced the local library with fictional sample data.');
  } else if (seedIfEmpty()) {
    console.log('Planted fictional sample data.');
  } else {
    console.log('Notely already has a library. Use npm run seed:reset to replace it with sample data.');
  }
  closeDb();
}
