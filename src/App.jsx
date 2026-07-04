import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const PAGE_SIZE = 25;

export default function PraiseDashboard() {
  const [tracks, setTracks] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null); 
  const [expandedTrack, setExpandedTrack] = useState(null);

  useEffect(() => {
    fetchTracks(page);
  }, [page]);

  async function fetchTracks(pageIndex) {
    setLoading(true);
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('playlist_tracks')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);
    
    if (error) console.error("Error fetching tracks:", error);
    else setTracks(data);
    
    setLoading(false);
  }

  async function deleteTrack(id) {
    const confirmDelete = window.confirm("Are you sure you want to remove this track?");
    if (!confirmDelete) return;

    setTracks(tracks.filter(t => t.id !== id));
    const { error } = await supabase.from('playlist_tracks').delete().eq('id', id);
    if (error) fetchTracks(page);
  }

  async function updateRating(id, newRating) {
    setTracks(tracks.map(t => t.id === id ? { ...t, rating: newRating } : t));
    await supabase.from('playlist_tracks').update({ rating: newRating }).eq('id', id);
  }

  async function runNARAnalysis(track) {
    setProcessingId(`nar-${track.id}`);
    try {
      const { data, error } = await supabase.functions.invoke('nar-audit', {
        body: { songTitle: track.title, artistName: track.artist }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const updates = { 
        nar_rating: data.verdict,
        nar_confidence: data.confidence_score,
        nar_summary: data.summary,
        nar_doctrinal_notes: data.doctrinal_notes,
        nar_association_notes: data.association_notes
      };

      await supabase.from('playlist_tracks').update(updates).eq('id', track.id);
      setTracks(tracks.map(t => t.id === track.id ? { ...t, ...updates } : t));
      setExpandedTrack(track.id);
    } catch (err) {
      console.error("NAR Analysis failed:", err);
      alert("Failed to run NAR check. Check console.");
    } finally {
      setProcessingId(null);
    }
  }

  async function runCategorization(track) {
    setProcessingId(`cat-${track.id}`);
    try {
      const { data, error } = await supabase.functions.invoke('liturgical-audit', {
        body: { songTitle: track.title, artistName: track.artist }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const updates = { 
        worship_category: data.liturgical_movement,
        worship_reasoning: data.theological_reasoning,
        worship_scripture: data.scripture_connection
      };

      await supabase.from('playlist_tracks').update(updates).eq('id', track.id);
      setTracks(tracks.map(t => t.id === track.id ? { ...t, ...updates } : t));
      setExpandedTrack(track.id);
    } catch (err) {
      console.error("Categorization failed:", err);
      alert("Failed to run Categorization. Check console.");
    } finally {
      setProcessingId(null);
    }
  }

  const toggleExpand = (id) => {
    setExpandedTrack(expandedTrack === id ? null : id);
  };

  const getNarBadgeColor = (rating) => {
    if (rating === 'Green') return 'bg-green-600';
    if (rating === 'Amber') return 'bg-yellow-600';
    if (rating === 'Red') return 'bg-red-600';
    return 'bg-gray-600';
  };

  return (
    <div className="p-8 bg-gray-900 min-h-screen text-white relative">
      
      {/* 1. THE BLOCKING OVERLAY MODAL */}
      {processingId && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-gray-800 p-8 rounded-lg border border-gray-600 shadow-2xl flex flex-col items-center">
            {/* Simple CSS Spinner */}
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mb-4"></div>
            <h2 className="text-2xl font-bold mb-2">Running Requested Audit</h2>
            <p className="text-gray-400">Please wait...</p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Praise Pipeline Command Center</h1>
        <div className="flex gap-4 items-center">
          <button disabled={page === 0 || loading} onClick={() => setPage(page - 1)} className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50">Prev</button>
          <span>Page {page + 1}</span>
          <button disabled={tracks.length < PAGE_SIZE || loading} onClick={() => setPage(page + 1)} className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50">Next</button>
        </div>
      </div>
      
      <div className="grid gap-4">
        {tracks.map(track => (
          <div key={track.id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex flex-col transition-all">
            
            <div className="p-4 flex items-center justify-between">
              
              <div className="flex-1 flex gap-4 items-start">
                {/* 3. THE COLLAPSIBLE TRAY BUTTON (Chevron) */}
                <button 
                  onClick={() => toggleExpand(track.id)} 
                  className={`mt-1 text-gray-400 hover:text-white transition-transform duration-200 ${expandedTrack === track.id ? 'rotate-180' : ''}`}
                  title="Toggle AI Details"
                >
                  ▼
                </button>

                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold">{track.title}</h2>
                    {track.nar_rating && <span className={`text-xs px-2 py-1 rounded font-bold ${getNarBadgeColor(track.nar_rating)}`}>NAR: {track.nar_rating}</span>}
                    {track.worship_category && <span className="text-xs px-2 py-1 rounded font-bold bg-blue-800">{track.worship_category.toUpperCase()}</span>}
                  </div>
                  
                  <p className="text-gray-400">{track.artist} | Source: {track.source}</p>
                  <div className="flex gap-4 mt-2 items-center">
                    <a href={track.youtube_link} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-sm font-medium">Watch on YouTube</a>
                    <button onClick={() => deleteTrack(track.id)} className="text-red-500 hover:text-red-400 text-sm font-medium">Remove Track</button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex gap-1 text-2xl cursor-pointer">
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} onClick={() => updateRating(track.id, star)} className={track.rating >= star ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400 transition-colors'}>★</span>
                  ))}
                </div>

                <div className="flex flex-col gap-2 w-48">
                  {/* 2. SMART BUTTONS: Change styling if data already exists */}
                  <button 
                    onClick={() => runNARAnalysis(track)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      track.nar_rating 
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                        : 'bg-red-900 hover:bg-red-800 text-white'
                    }`}
                  >
                    {track.nar_rating ? 'Re-run NAR Check' : 'Run NAR Check'}
                  </button>

                  <button 
                    onClick={() => runCategorization(track)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      track.worship_category 
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                        : 'bg-blue-900 hover:bg-blue-800 text-white'
                    }`}
                  >
                    {track.worship_category ? 'Re-run Four-Fold' : 'Run Four-Fold'}
                  </button>
                </div>
              </div>
            </div>

            {/* AI DETAILS DRAWER */}
            {expandedTrack === track.id && (
              <div className="bg-gray-900 p-6 border-t border-gray-700 text-sm grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-blue-400 font-bold mb-3 border-b border-gray-700 pb-1">Four-Fold Liturgical Model</h3>
                  {track.worship_category ? (
                    <div className="space-y-3">
                      <p><span className="text-gray-400 font-semibold">Movement:</span> {track.worship_category}</p>
                      <p><span className="text-gray-400 font-semibold">Reasoning:</span> {track.worship_reasoning}</p>
                      {track.worship_scripture && <p><span className="text-gray-400 font-semibold">Scripture:</span> {track.worship_scripture}</p>}
                    </div>
                  ) : <p className="text-gray-500 italic">No Liturgical analysis run yet.</p>}
                </div>

                <div>
                  <h3 className="text-blue-400 font-bold mb-3 border-b border-gray-700 pb-1">NAR & Theological Audit</h3>
                  {track.nar_rating ? (
                    <div className="space-y-3">
                      <div className="flex gap-4">
                        <p><span className="text-gray-400 font-semibold">Verdict:</span> {track.nar_rating}</p>
                        <p><span className="text-gray-400 font-semibold">Confidence:</span> {track.nar_confidence}%</p>
                      </div>
                      <p><span className="text-gray-400 font-semibold">Summary:</span> {track.nar_summary}</p>
                      
                      {track.nar_doctrinal_notes?.details?.length > 0 && (
                        <div>
                          <span className="text-gray-400 font-semibold">Doctrinal Notes:</span>
                          <ul className="list-disc pl-5 mt-1 text-gray-300">
                            {track.nar_doctrinal_notes.details.map((note, i) => <li key={i}>{note}</li>)}
                          </ul>
                        </div>
                      )}
                      
                      {track.nar_association_notes?.details?.length > 0 && (
                        <div>
                          <span className="text-gray-400 font-semibold">Association Notes:</span>
                          <ul className="list-disc pl-5 mt-1 text-gray-300">
                            {track.nar_association_notes.details.map((note, i) => <li key={i}>{note}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : <p className="text-gray-500 italic">No NAR analysis run yet.</p>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}