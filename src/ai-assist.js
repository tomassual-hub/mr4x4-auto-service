/* ============================= AI INSPECTION SUGGESTIONS =============================
   Calls the ai-suggest-checklist Edge Function (see supabase/functions/) to
   suggest likely causes and which checklist items to check first, based on
   a job's description -- a starting point for the mechanic, never a
   diagnosis on its own. The actual checklist is still filled in by hand,
   item by item, exactly as before; this only highlights where to look.
   Uses Google's Gemini API (free tier, no subscription) server-side in the
   Edge Function -- no API key or AI call ever happens client-side. */

async function requestAiSuggestion(job){
  const v = getVehicle(job.vehicleId);
  if(!(job.description||'').trim()){
    showToast(tt('Tiada penerangan kerja untuk dianalisis.'));
    return;
  }
  state.aiSuggestion = 'loading';
  render();
  try{
    const { data, error } = await supabaseClient.functions.invoke('ai-suggest-checklist', {
      body: { description: job.description, vehicleModel: v ? v.model : null }
    });
    if(error) throw error;
    if(!data || data.error){
      state.aiSuggestion = 'unavailable';
      render();
      return;
    }
    state.aiSuggestion = { likelyCauses: data.likelyCauses||[], suggestedItems: data.suggestedItems||[] };
    render();
  }catch(e){
    reportError(e, 'Gagal dapatkan cadangan AI');
    state.aiSuggestion = 'unavailable';
    render();
  }
}
