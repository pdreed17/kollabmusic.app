'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import UserSearch from './UserSearch'

interface User {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

interface InvitedUser extends User {
  role: 'admin' | 'editor'
  showRoleDropdown?: boolean
}

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onProjectCreated: (projectId: string) => void
  userId: string
}

export default function CreateProjectModal({ isOpen, onClose, onProjectCreated, userId }: CreateProjectModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleAddUser = (user: User) => {
    // Check if already added
    if (invitedUsers.find(u => u.id === user.id)) return

    setInvitedUsers(prev => [...prev, { ...user, role: 'editor' }])
  }

  const handleRemoveUser = (userId: string) => {
    setInvitedUsers(prev => prev.filter(u => u.id !== userId))
  }

  const handleRoleChange = (userId: string, role: 'admin' | 'editor') => {
    setInvitedUsers(prev =>
      prev.map(u => u.id === userId ? { ...u, role, showRoleDropdown: false } : u)
    )
  }

  const toggleRoleDropdown = (userId: string) => {
    setInvitedUsers(prev =>
      prev.map(u => u.id === userId ? { ...u, showRoleDropdown: !u.showRoleDropdown } : { ...u, showRoleDropdown: false })
    )
  }

  const closeAllDropdowns = () => {
    setInvitedUsers(prev =>
      prev.map(u => ({ ...u, showRoleDropdown: false }))
    )
  }

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Project title is required')
      return
    }

    setCreating(true)
    setError(null)

    try {
      // Create the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          creator_id: userId,
          is_public: false,
        })
        .select('id')
        .single()

      if (projectError) throw projectError

      // Add creator as owner in project_collaborators
      const { error: ownerError } = await supabase
        .from('project_collaborators')
        .insert({
          project_id: project.id,
          user_id: userId,
          role: 'owner',
          status: 'accepted',
          can_edit: true,
          can_delete: true,
          can_invite: true,
          can_manage_settings: true,
        })

      if (ownerError) {
        console.error('Error adding owner:', ownerError)
      }

      // Send invitations to all invited users
      for (const invitedUser of invitedUsers) {
        const permissions = invitedUser.role === 'admin'
          ? { can_edit: true, can_delete: true, can_invite: true, can_upload: true, can_comment: true, can_download: true }
          : { can_edit: true, can_delete: false, can_invite: false, can_upload: true, can_comment: true, can_download: true }

        const { error: inviteError } = await supabase
          .from('project_collaborators')
          .insert({
            project_id: project.id,
            user_id: invitedUser.id,
            role: invitedUser.role,
            invitation_status: 'pending',
            invited_by: userId,
            ...permissions,
          })

        if (inviteError) {
          console.error('Error inviting user:', inviteError)
        }
      }

      // Reset form
      setTitle('')
      setDescription('')
      setInvitedUsers([])

      onProjectCreated(project.id)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    if (creating) return
    setTitle('')
    setDescription('')
    setInvitedUsers([])
    setError(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#1A1A1A] border border-[#404040] rounded-xl shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#404040]">
          <h2 className="text-lg font-semibold text-white">Create New Project</h2>
          <button
            onClick={handleClose}
            disabled={creating}
            className="p-1.5 text-[#8B8B8B] hover:text-white transition-colors rounded-lg hover:bg-[#262626] disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#F87171] rounded-lg p-3 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Project Title */}
          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">
              Project Title <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={creating}
              className="w-full px-4 py-3 bg-[#262626] border border-[#404040] rounded-lg text-white placeholder-[#8B8B8B] input-focus disabled:opacity-50"
              placeholder="Enter project title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">
              Description <span className="text-[#8B8B8B] font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={creating}
              rows={3}
              className="w-full px-4 py-3 bg-[#262626] border border-[#404040] rounded-lg text-white placeholder-[#8B8B8B] input-focus resize-none disabled:opacity-50"
              placeholder="Describe your project..."
            />
          </div>

          {/* Invite Kollaborators */}
          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">
              Invite Kollaborators <span className="text-[#8B8B8B] font-normal">(optional)</span>
            </label>
            <UserSearch
              onSelect={handleAddUser}
              excludeUserIds={[userId, ...invitedUsers.map(u => u.id)]}
              placeholder="Search by name or username..."
            />

            {/* Invited Users List */}
            {invitedUsers.length > 0 && (
              <div className="mt-3 space-y-3">
                {invitedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="p-3 bg-[#262626] border border-[#404040] rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover border border-[#404040]"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-[#404040] flex items-center justify-center">
                          <svg className="w-4 h-4 text-[#8B8B8B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">
                          {user.display_name || user.username || 'Unknown'}
                        </p>
                        {user.username && (
                          <p className="text-[#8B8B8B] text-xs truncate">@{user.username}</p>
                        )}
                      </div>

                      {/* Role Selector - Custom Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => toggleRoleDropdown(user.id)}
                          disabled={creating}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                            user.role === 'admin'
                              ? 'bg-[#6366F1]/20 border border-[#6366F1]/40 text-[#818CF8]'
                              : 'bg-[#3B82F6]/20 border border-[#3B82F6]/40 text-[#60A5FA]'
                          }`}
                        >
                          {user.role === 'admin' ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          )}
                          {user.role === 'admin' ? 'Admin' : 'Editor'}
                          <svg className={`w-3 h-3 transition-transform ${user.showRoleDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Dropdown Menu */}
                        {user.showRoleDropdown && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-[#262626] border border-[#404040] rounded-lg shadow-lg z-10 overflow-hidden animate-slide-up">
                            <button
                              onClick={() => handleRoleChange(user.id, 'editor')}
                              className={`w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-[#303030] transition-colors ${
                                user.role === 'editor' ? 'bg-[#3B82F6]/10' : ''
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                user.role === 'editor' ? 'bg-[#3B82F6]/20' : 'bg-[#404040]'
                              }`}>
                                <svg className={`w-3 h-3 ${user.role === 'editor' ? 'text-[#60A5FA]' : 'text-[#8B8B8B]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <p className={`text-xs font-medium ${user.role === 'editor' ? 'text-[#60A5FA]' : 'text-white'}`}>Editor</p>
                                <p className="text-[10px] text-[#8B8B8B]">Upload, edit & comment</p>
                              </div>
                              {user.role === 'editor' && (
                                <svg className="w-4 h-4 text-[#60A5FA]" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => handleRoleChange(user.id, 'admin')}
                              className={`w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-[#303030] transition-colors ${
                                user.role === 'admin' ? 'bg-[#6366F1]/10' : ''
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                user.role === 'admin' ? 'bg-[#6366F1]/20' : 'bg-[#404040]'
                              }`}>
                                <svg className={`w-3 h-3 ${user.role === 'admin' ? 'text-[#818CF8]' : 'text-[#8B8B8B]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <p className={`text-xs font-medium ${user.role === 'admin' ? 'text-[#818CF8]' : 'text-white'}`}>Admin</p>
                                <p className="text-[10px] text-[#8B8B8B]">Full access & can invite</p>
                              </div>
                              {user.role === 'admin' && (
                                <svg className="w-4 h-4 text-[#818CF8]" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => handleRemoveUser(user.id)}
                        disabled={creating}
                        className="p-1 text-[#8B8B8B] hover:text-[#EF4444] transition-colors disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Permissions for this user */}
                    <div className="mt-2 pt-2 border-t border-[#404040]/50">
                      <p className="text-[10px] text-[#8B8B8B] uppercase tracking-wide mb-1.5">Permissions</p>
                      <div className="flex flex-wrap gap-1.5">
                        {/* Shared permissions (both roles) */}
                        {['Upload', 'Edit', 'Comment', 'Download'].map((perm) => (
                          <span key={perm} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#10B981]/10 border border-[#10B981]/20 rounded text-[10px] text-[#34D399]">
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {perm}
                          </span>
                        ))}
                        {/* Admin-only permissions */}
                        {['Delete', 'Invite'].map((perm) => (
                          <span
                            key={perm}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${
                              user.role === 'admin'
                                ? 'bg-[#10B981]/10 border border-[#10B981]/20 text-[#34D399]'
                                : 'bg-[#404040]/30 border border-[#404040]/50 text-[#8B8B8B] line-through'
                            }`}
                          >
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                              {user.role === 'admin' ? (
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              ) : (
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              )}
                            </svg>
                            {perm}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Role Explanation - show only when no users added */}
            {invitedUsers.length === 0 && (
              <div className="mt-3 p-3 bg-[#262626]/50 border border-[#404040]/50 rounded-lg space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#3B82F6]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-2.5 h-2.5 text-[#60A5FA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#60A5FA]">Editor</p>
                    <p className="text-[10px] text-[#8B8B8B]">Can upload, edit, and comment on files</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#6366F1]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-2.5 h-2.5 text-[#818CF8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#818CF8]">Admin</p>
                    <p className="text-[10px] text-[#8B8B8B]">Full access - can edit, delete, invite, and manage everything</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-5 border-t border-[#404040]">
          <button
            onClick={handleClose}
            disabled={creating}
            className="flex-1 py-3 px-4 bg-[#262626] border border-[#404040] rounded-lg font-medium text-white hover:bg-[#303030] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !title.trim()}
            className="flex-1 py-3 px-4 btn-primary rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 spinner" />
                Creating...
              </span>
            ) : (
              'Create Project'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
