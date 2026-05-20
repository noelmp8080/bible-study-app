const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  askScholar: (messages, systemPrompt) =>
    ipcRenderer.invoke('ask-scholar', messages, systemPrompt),
})
