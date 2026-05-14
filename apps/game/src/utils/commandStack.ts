import type { EditorCommand } from '../types/editor'

const MAX_COMMANDS = 50

export class CommandStack {
  private undoStack: EditorCommand[] = []
  private redoStack: EditorCommand[] = []
  private listeners: Set<() => void> = new Set()

  push(command: EditorCommand): void {
    command.execute()
    this.undoStack.push(command)
    if (this.undoStack.length > MAX_COMMANDS) {
      this.undoStack.shift()
    }
    this.redoStack = []
    this.notify()
  }

  undo(): void {
    const command = this.undoStack.pop()
    if (!command) return
    command.undo()
    this.redoStack.push(command)
    this.notify()
  }

  redo(): void {
    const command = this.redoStack.pop()
    if (!command) return
    command.execute()
    this.undoStack.push(command)
    this.notify()
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.notify()
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  get undoDescription(): string | null {
    const last = this.undoStack[this.undoStack.length - 1]
    return last ? last.description : null
  }

  get redoDescription(): string | null {
    const last = this.redoStack[this.redoStack.length - 1]
    return last ? last.description : null
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach(fn => fn())
  }
}

export const editorCommandStack = new CommandStack()
