// Supabase Edge Function for server-side audio trimming using FFmpeg
// Deploy with: supabase functions deploy trimAudio

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TrimRequest {
  audioFileId: string
  sourceFilePath: string
  startMs: number
  endMs: number
  projectId: string
  userId: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse request body
    const body: TrimRequest = await req.json()
    const { audioFileId, sourceFilePath, startMs, endMs, projectId, userId } = body

    // Validate inputs
    if (!audioFileId || !sourceFilePath || startMs === undefined || endMs === undefined) {
      throw new Error('Missing required parameters')
    }

    if (user.id !== userId) {
      throw new Error('User ID mismatch')
    }

    if (startMs < 0 || endMs <= startMs) {
      throw new Error('Invalid trim times')
    }

    console.log('Trimming audio:', { audioFileId, startMs, endMs })

    // Download the source file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('audio-files')
      .download(sourceFilePath)

    if (downloadError) {
      throw new Error(`Failed to download source file: ${downloadError.message}`)
    }

    // Convert Blob to ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer()
    const sourceBuffer = new Uint8Array(arrayBuffer)

    // Write source file to temp location
    const tempInputPath = `/tmp/input_${Date.now()}.m4a`
    await Deno.writeFile(tempInputPath, sourceBuffer)

    // Calculate trim duration
    const startSeconds = startMs / 1000
    const endSeconds = endMs / 1000
    const duration = endSeconds - startSeconds

    // Prepare output path
    const tempOutputPath = `/tmp/trimmed_${Date.now()}.m4a`

    // Run FFmpeg to trim the audio
    // ffmpeg -i input.m4a -ss START_TIME -t DURATION -c copy output.m4a
    let ffmpegProcess
    try {
      ffmpegProcess = new Deno.Command('ffmpeg', {
        args: [
          '-i', tempInputPath,
          '-ss', startSeconds.toString(),
          '-t', duration.toString(),
          '-c', 'copy',
          '-y', // Overwrite output file if exists
          tempOutputPath
        ],
        stdout: 'piped',
        stderr: 'piped',
      })
    } catch (cmdError) {
      console.error('Failed to create FFmpeg command:', cmdError)
      throw new Error(`FFmpeg not available: ${cmdError.message}`)
    }

    const { code, stdout, stderr } = await ffmpegProcess.output()

    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr)
      console.error('FFmpeg error:', errorText)
      throw new Error(`FFmpeg failed with code ${code}: ${errorText.substring(0, 200)}`)
    }

    console.log('FFmpeg trimming completed successfully')

    // Read the trimmed file
    const trimmedBuffer = await Deno.readFile(tempOutputPath)

    // Upload trimmed file to Supabase Storage
    const trimmedFileName = `${projectId}/${userId}/trimmed_${Date.now()}_${startMs}_${endMs}.m4a`

    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('audio-files')
      .upload(trimmedFileName, trimmedBuffer, {
        contentType: 'audio/m4a',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Failed to upload trimmed file: ${uploadError.message}`)
    }

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from('audio-files')
      .getPublicUrl(trimmedFileName)

    // Clean up temp files
    try {
      await Deno.remove(tempInputPath)
      await Deno.remove(tempOutputPath)
    } catch (cleanupError) {
      console.warn('Failed to clean up temp files:', cleanupError)
    }

    console.log('Trim successful:', urlData.publicUrl)

    return new Response(
      JSON.stringify({
        success: true,
        trimmedFilePath: urlData.publicUrl,
        fileName: trimmedFileName,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in trimAudio function:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An error occurred while trimming audio',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
