import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Check if requester is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No auth header')
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Unauthorized')

    const { data: isAdmin } = await supabaseClient.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    if (!isAdmin) throw new Error('Forbidden')

    const body = await req.json()
    const { action, email, password, displayName, targetUserId, agentKeys } = body

    if (action === 'create_user') {
      if (!email || !password) throw new Error('Email and password are required')

      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName || email.split('@')[0] }
      })

      if (createError) throw createError

      // Update profile to force password change
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .update({ must_change_password: true })
        .eq('user_id', newUser.user.id)

      if (profileError) console.error('Error updating profile:', profileError)

      return new Response(JSON.stringify({ user: newUser.user }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (action === 'list_users') {
        const { data: { users }, error: listError } = await supabaseClient.auth.admin.listUsers()
        if (listError) throw listError
        
        // Fetch profiles for these users
        const { data: profiles } = await supabaseClient.from('profiles').select('*')
        
        const combined = users.map(u => ({
            ...u,
            profile: profiles?.find(p => p.user_id === u.id)
        }))

        return new Response(JSON.stringify({ users: combined }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }

    if (action === 'reset_password') {
      if (!targetUserId || !password) throw new Error('targetUserId and password required')

      const { error: updErr } = await supabaseClient.auth.admin.updateUserById(targetUserId, {
        password,
      })
      if (updErr) throw updErr

      // Marca pra trocar no próximo login
      await supabaseClient
        .from('profiles')
        .update({ must_change_password: true })
        .eq('user_id', targetUserId)

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    if (action === 'set_granted_agents') {
      if (!targetUserId || !Array.isArray(agentKeys)) {
        throw new Error('targetUserId and agentKeys[] required')
      }
      const cleaned = agentKeys
        .filter((k: unknown): k is string => typeof k === 'string')
        .map((k) => k.trim())
        .filter(Boolean)

      const { error: gErr } = await supabaseClient
        .from('profiles')
        .update({ granted_agent_keys: cleaned })
        .eq('user_id', targetUserId)
      if (gErr) throw gErr

      return new Response(JSON.stringify({ ok: true, granted_agent_keys: cleaned }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    throw new Error('Invalid action')
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
