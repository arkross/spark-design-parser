export {};

declare global {
  interface Window {
    showDirectoryPicker: () => Promise<FileSystemDirectoryHandler>;
  }
  interface FileSystemDirectoryHandle {
    entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
  }
}