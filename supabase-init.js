// supabase-init.js
// Inicializa o cliente Supabase e expõe globalmente (substitui firebase-init.js)

const SUPABASE_URL = 'https://bljjasngyijsrisnohvx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsamphc25neWlqc3Jpc25vaHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjQ5OTcsImV4cCI6MjA5MzE0MDk5N30.U6jV7AXfguQ7HSQUVNEq1EF_cazKJPDbjnBI5WV4o50';

window._supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
