import { useState, useCallback } from 'react'
import { t } from '../../utils/i18n'
import './YAMLTemplateModal.css'

function YAMLTemplateModal({ templates, onApply, onSave, onClose, lang }) {
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateContent, setNewTemplateContent] = useState('')

  const handleCreateTemplate = useCallback(() => {
    if (!newTemplateName.trim()) return

    const newTemplate = {
      id: Date.now().toString(),
      name: newTemplateName,
      content: newTemplateContent || `---
title: {{title}}
date: {{date}}
tags: []
categories: []
---`
    }

    onSave([...templates, newTemplate])
    setNewTemplateName('')
    setNewTemplateContent('')
  }, [newTemplateName, newTemplateContent, templates, onSave])

  const handleDeleteTemplate = useCallback((id) => {
    onSave(templates.filter(t => t.id !== id))
  }, [templates, onSave])

  const handleUpdateTemplate = useCallback(() => {
    if (!editingTemplate) return

    onSave(templates.map(t =>
      t.id === editingTemplate.id ? editingTemplate : t
    ))
    setEditingTemplate(null)
  }, [editingTemplate, templates, onSave])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('yamlTemplates', lang)}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="templates-list">
            <h3>{t('availableTemplates', lang)}</h3>
            {templates.map(template => (
              <div key={template.id} className="template-item">
                <div className="template-info">
                  <span className="template-name">{template.name}</span>
                </div>
                <div className="template-actions">
                  <button
                    className="action-btn apply"
                    onClick={() => onApply(template)}
                  >
                    {t('apply', lang)}
                  </button>
                  <button
                    className="action-btn edit"
                    onClick={() => setEditingTemplate({ ...template })}
                  >
                    {t('edit', lang)}
                  </button>
                  <button
                    className="action-btn delete"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    {t('delete', lang)}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {editingTemplate && (
            <div className="template-editor">
              <h3>{t('edit', lang)}</h3>
              <input
                type="text"
                value={editingTemplate.name}
                onChange={(e) => setEditingTemplate({
                  ...editingTemplate,
                  name: e.target.value
                })}
                placeholder={t('templateName', lang)}
                className="template-input"
              />
              <textarea
                value={editingTemplate.content}
                onChange={(e) => setEditingTemplate({
                  ...editingTemplate,
                  content: e.target.value
                })}
                placeholder={t('yamlContent', lang)}
                className="template-textarea"
                rows={10}
              />
              <div className="template-editor-actions">
                <button className="action-btn save" onClick={handleUpdateTemplate}>
                  {t('saveConfig', lang)}
                </button>
                <button
                  className="action-btn cancel"
                  onClick={() => setEditingTemplate(null)}
                >
                  {t('cancel', lang)}
                </button>
              </div>
            </div>
          )}

          <div className="create-template">
            <h3>{t('createNewTemplate', lang)}</h3>
            <input
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder={t('templateName', lang)}
              className="template-input"
            />
            <textarea
              value={newTemplateContent}
              onChange={(e) => setNewTemplateContent(e.target.value)}
              placeholder={`---
title: {{title}}
date: {{date}}
tags: []
---`}
              className="template-textarea"
              rows={6}
            />
            <button
              className="action-btn create"
              onClick={handleCreateTemplate}
              disabled={!newTemplateName.trim()}
            >
              {t('createTemplate', lang)}
            </button>
          </div>

          <div className="variables-help">
            <h3>{t('availableVariables', lang)}</h3>
            <table className="variables-table">
              <thead>
                <tr>
                  <th>{t('variable', lang)}</th>
                  <th>{t('description', lang)}</th>
                </tr>
              </thead>
              <tbody>
                <tr><td><code>{'{{title}}'}</code></td><td>{t('varTitle', lang)}</td></tr>
                <tr><td><code>{'{{date}}'}</code></td><td>{t('varDate', lang)}</td></tr>
                <tr><td><code>{'{{time}}'}</code></td><td>{t('varTime', lang)}</td></tr>
                <tr><td><code>{'{{datetime}}'}</code></td><td>{t('varDatetime', lang)}</td></tr>
                <tr><td><code>{'{{image}}'}</code></td><td>{t('varImage', lang)}</td></tr>
                <tr><td><code>{'{{category}}'}</code></td><td>{t('varCategory', lang)}</td></tr>
                <tr><td><code>{'{{tags}}'}</code></td><td>{t('varTags', lang)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default YAMLTemplateModal
