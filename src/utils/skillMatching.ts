/**
 * Skill Matching Utilities
 *
 * Helper functions for matching user skills with project collaboration needs
 */

/**
 * Check if user's skills match any of the project's collaboration needs
 * @param userSpecialties - Array of user's skill specialties
 * @param projectCollaborationNeeds - Array of skills the project is looking for
 * @returns true if there's at least one matching skill
 */
export const hasSkillMatch = (
  userSpecialties: string[] | null | undefined,
  projectCollaborationNeeds: string[] | null | undefined
): boolean => {
  if (!userSpecialties || !projectCollaborationNeeds) {
    return false
  }

  if (userSpecialties.length === 0 || projectCollaborationNeeds.length === 0) {
    return false
  }

  return projectCollaborationNeeds.some(need =>
    userSpecialties.includes(need)
  )
}

/**
 * Get the matching skills between user and project
 * @param userSpecialties - Array of user's skill specialties
 * @param projectCollaborationNeeds - Array of skills the project is looking for
 * @returns Array of matching skill IDs
 */
export const getMatchingSkills = (
  userSpecialties: string[] | null | undefined,
  projectCollaborationNeeds: string[] | null | undefined
): string[] => {
  if (!userSpecialties || !projectCollaborationNeeds) {
    return []
  }

  return projectCollaborationNeeds.filter(need =>
    userSpecialties.includes(need)
  )
}

/**
 * Get a human-readable string of matching skills
 * @param matchingSkills - Array of matching skill IDs
 * @param skillsMap - Map of skill IDs to their labels
 * @returns Formatted string like "Vocals, Mixing"
 */
export const formatMatchingSkills = (
  matchingSkills: string[],
  skillsMap: { [key: string]: { label: string } }
): string => {
  return matchingSkills
    .map(skillId => skillsMap[skillId]?.label)
    .filter(Boolean)
    .join(', ')
}
