import LinkExtension from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { NoteDoc } from '../api/types'

interface EditorProps {
  noteId: number
  content: NoteDoc
  refreshKey: string
  onChange: (json: NoteDoc, text: string) => void
  onSave: () => void
}

export function RichEditor({ noteId, content, refreshKey, onChange, onSave }: EditorProps) {
  const saveRef = useRef(onSave)
  const changeRef = useRef(onChange)
  saveRef.current = onSave
  changeRef.current = onChange
  const fileRef = useRef<HTMLInputElement>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [href, setHref] = useState('https://')
  const editor = useEditor({
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        link: false,
        heading: { levels: [1, 2, 3] },
      }),
      LinkExtension.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Begin writing. The cottage is quiet.' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ allowBase64: true }),
    ],
    content,
    editorProps: {
      attributes: { 'aria-label': 'Note body' },
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault()
          saveRef.current()
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor: current }) => {
      changeRef.current(current.getJSON() as NoteDoc, current.getText())
    },
  }, [noteId])

  useEffect(() => {
    if (!editor) return
    editor.commands.setContent(content, { emitUpdate: false })
  }, [editor, refreshKey])

  if (!editor) return <p>Opening the desk…</p>
  const words = editor.getText().trim() ? editor.getText().trim().split(/\s+/).length : 0

  function addImage(file: File) {
    if (!file.type.startsWith('image/')) return
    if (file.size > 1_500_000) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') editor?.chain().focus().setImage({ src: reader.result, alt: file.name }).run()
    }
    reader.readAsDataURL(file)
  }

  const item = (label: string, icon: ReactNode, active: boolean, command: () => void) => (
    <button className={`icon-btn ${active ? 'is-on' : ''}`} type="button" aria-label={label} aria-pressed={active} onClick={command}>
      {icon}
    </button>
  )

  return (
    <div>
      <div className="editor-toolbar" role="toolbar" aria-label="Formatting">
        {item('Bold', <Bold size={16} />, editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
        {item('Italic', <Italic size={16} />, editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
        {item('Underline', <Underline size={16} />, editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run())}
        {item('Strikethrough', <Strikethrough size={16} />, editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run())}
        {item('Heading', <Heading2 size={16} />, editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        {item('Bullet list', <List size={16} />, editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run())}
        {item('Numbered list', <ListOrdered size={16} />, editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run())}
        {item('Checklist', <ListChecks size={16} />, editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run())}
        {item('Quote', <Quote size={16} />, editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run())}
        {item('Code', <Code size={16} />, editor.isActive('codeBlock'), () => editor.chain().focus().toggleCodeBlock().run())}
        {item('Divider', <Minus size={16} />, false, () => editor.chain().focus().setHorizontalRule().run())}
        {item('Align left', <AlignLeft size={16} />, editor.isActive({ textAlign: 'left' }), () => editor.chain().focus().setTextAlign('left').run())}
        {item('Align centre', <AlignCenter size={16} />, editor.isActive({ textAlign: 'center' }), () => editor.chain().focus().setTextAlign('center').run())}
        {item('Align right', <AlignRight size={16} />, editor.isActive({ textAlign: 'right' }), () => editor.chain().focus().setTextAlign('right').run())}
        {item('Link', <Link2 size={16} />, editor.isActive('link'), () => setLinkOpen((open) => !open))}
        {item('Image', <ImagePlus size={16} />, false, () => fileRef.current?.click())}
        {item('Undo', <Undo2 size={16} />, false, () => editor.chain().focus().undo().run())}
        {item('Redo', <Redo2 size={16} />, false, () => editor.chain().focus().redo().run())}
      </div>
      {linkOpen && (
        <form className="link-pop" onSubmit={(event) => { event.preventDefault(); editor.chain().focus().extendMarkRange('link').setLink({ href }).run(); setLinkOpen(false) }}>
          <input aria-label="Link address" value={href} onChange={(event) => setHref(event.target.value)} />
          <button className="btn btn-small btn-primary" type="submit">Add link</button>
          <button className="btn btn-small btn-ghost" type="button" onClick={() => editor.chain().focus().unsetLink().run()}>Remove</button>
        </form>
      )}
      <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) addImage(file) }} />
      <EditorContent editor={editor} />
      <p className="editor-foot">{words} words · {editor.getText().length} characters</p>
    </div>
  )
}
