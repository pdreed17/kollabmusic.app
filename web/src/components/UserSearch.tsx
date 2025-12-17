'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface User {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

interface UserSearchProps {
  onSelect: (user: User) => void
  excludeUserIds?: string[]
  placeholder?: string
}

export default function UserSearch({ onSelect, excludeUserIds = [], placeholder = 'Search by username...' }: UserSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!query.trim()) {
      setResults([])
      setShowDropdown(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const searchTerm = query.trim().toLowerCase()

        // Search by username or display_name
        const { data, error } = await supabase
          .from('users')
          .select('id, username, display_name, avatar_url')
          .or(`username.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
          .limit(8)

        if (error) throw error

        // Filter out excluded users
        const filtered = (data || []).filter(user => !excludeUserIds.includes(user.id))
        setResults(filtered)
        setShowDropdown(filtered.length > 0)
      } catch (err) {
        console.error('Search error:', err)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300) // 300ms debounce

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, excludeUserIds])

  const handleSelect = (user: User) => {
    onSelect(user)
    setQuery('')
    setResults([])
    setShowDropdown(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full px-4 py-3 bg-[#1A1A1A] border border-[#404040] rounded-lg text-white placeholder-[#8B8B8B] input-focus pr-10"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 spinner" />
          </div>
        )}
        {!loading && query && (
          <button
            onClick={() => {
              setQuery('')
              setResults([])
              setShowDropdown(false)
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B8B8B] hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-[#262626] border border-[#404040] rounded-lg shadow-lg max-h-64 overflow-y-auto animate-slide-up">
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelect(user)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#303030] transition-colors text-left border-b border-[#404040] last:border-b-0"
            >
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

              {/* Name & Username */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">
                  {user.display_name || user.username || 'Unknown User'}
                </p>
                {user.username && (
                  <p className="text-[#8B8B8B] text-xs truncate">@{user.username}</p>
                )}
              </div>

              {/* Add Icon */}
              <div className="text-[#6366F1]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results Message */}
      {showDropdown && results.length === 0 && !loading && query.trim() && (
        <div className="absolute z-50 w-full mt-1 bg-[#262626] border border-[#404040] rounded-lg p-4 text-center">
          <p className="text-[#8B8B8B] text-sm">No users found matching "{query}"</p>
        </div>
      )}
    </div>
  )
}
