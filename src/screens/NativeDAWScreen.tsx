/**
 * Native DAW Screen
 *
 * Main screen that hosts the Native DAW component and handles navigation integration.
 */

import React, { useState, useEffect } from 'react'
import { Alert } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import NativeDAW from '../components/NativeDAW'

interface NativeDAWScreenProps {
  route: {
    params: {
      projectId: string
      projectData: any
      audioFiles: any[]
    }
  }
  navigation: any
}

export default function NativeDAWScreen({ route, navigation }: NativeDAWScreenProps) {
  const { projectId, projectData, audioFiles: initialAudioFiles } = route.params
  const { user } = useAuth()

  const [audioFiles, setAudioFiles] = useState(initialAudioFiles)
  const [project, setProject] = useState(projectData)

  // Handle project updates
  const handleProjectUpdate = (updates: any) => {
    setProject((prev: any) => ({ ...prev, ...updates }))
  }

  // Handle audio files updates
  const handleAudioFilesUpdate = (updatedAudioFiles: any[]) => {
    setAudioFiles(updatedAudioFiles)
  }

  // Handle back navigation
  const handleBack = () => {
    navigation.goBack()
  }

  // Handle any errors from the DAW system
  const handleError = (error: string) => {
    console.error('Native DAW Error:', error)
    Alert.alert('DAW Error', error)
  }

  return (
    <NativeDAW
      projectId={projectId}
      projectData={project}
      audioFiles={audioFiles}
      onProjectUpdate={handleProjectUpdate}
      onAudioFilesUpdate={handleAudioFilesUpdate}
      onBack={handleBack}
      navigation={navigation}
    />
  )
}