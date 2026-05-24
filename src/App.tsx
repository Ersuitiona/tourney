/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Trophy, Users, Calendar, LayoutGrid, Settings, 
  ChevronRight, Plus, Upload, Edit2, Check, X, 
  Shuffle, ArrowRightLeft, Swords, Medal, History,
  Download, AlertTriangle, Camera, Trash2, Save,
  ArrowUpRight, Info, ChevronDown, FileText, Image as ImageIcon,
  Sparkles, Loader2, RefreshCw, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// --- UTILS ---
const generateId = () => Math.random().toString(36).substring(2, 11);

const INITIAL_GROUPS = [
  { id: 'group_a', name: 'Group A', clubIds: [] },
  { id: 'group_b', name: 'Group B', clubIds: [] },
];

/**
 * Main Tournament Organizer Component
 */
export default function App() {
  const [view, setView] = useState<'home' | 'arena' | 'hallOfFame'>(() => {
    const saved = localStorage.getItem('tournament_view');
    if (saved) return saved as any;
    const savedName = localStorage.getItem('tournament_name');
    if (savedName) return 'arena';
    return 'home';
  }); 
  const [activeTab, setActiveTab] = useState<'clubs' | 'groups' | 'fixtures' | 'standings' | 'bracket'>(() => {
    const saved = localStorage.getItem('tournament_activeTab');
    return (saved as any) || 'clubs';
  });
  const [tournamentName, setTournamentName] = useState<string | null>(() => {
    return localStorage.getItem('tournament_name') || null;
  });

  // Scheduling & UI State
  const [schedulingMode, setSchedulingMode] = useState<'algorithmic' | 'ai'>('algorithmic');
  const [isGeneratingFixtures, setIsGeneratingFixtures] = useState(false);
  const [fixtureError, setFixtureError] = useState<string | null>(null);

  // Export Preview Modal State
  const [exportImgSrc, setExportImgSrc] = useState<string | null>(null);
  const [exportType, setExportType] = useState<'png' | 'pdf' | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Data State
  const [clubs, setClubs] = useState<{id: string, name: string, logo?: string}[]>(() => {
    const saved = localStorage.getItem('tournament_clubs');
    return saved ? JSON.parse(saved) : [];
  });
  const [groups, setGroups] = useState<any[]>(() => {
    const saved = localStorage.getItem('tournament_groups');
    return saved ? JSON.parse(saved) : INITIAL_GROUPS;
  });
  const [fixtures, setFixtures] = useState<any[]>(() => {
    const saved = localStorage.getItem('tournament_fixtures');
    return saved ? JSON.parse(saved) : [];
  });
  const [bracketMatches, setBracketMatches] = useState<any[]>(() => {
    const saved = localStorage.getItem('tournament_bracketMatches');
    return saved ? JSON.parse(saved) : [];
  });
  const [hallOfFame, setHallOfFame] = useState(() => {
    const saved = localStorage.getItem('tournament_hallOfFame');
    return saved ? JSON.parse(saved) : [
      { id: '1', season: '2023', winner: 'Real Madrid', runnerUp: 'Dortmund' },
      { id: '2', season: '2024 (Summer)', winner: 'Man City', runnerUp: 'Inter' }
    ];
  });

  // Sync state to local storage automatically
  useEffect(() => {
    localStorage.setItem('tournament_view', view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem('tournament_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (tournamentName) {
      localStorage.setItem('tournament_name', tournamentName);
    } else {
      localStorage.removeItem('tournament_name');
    }
  }, [tournamentName]);

  useEffect(() => {
    localStorage.setItem('tournament_clubs', JSON.stringify(clubs));
  }, [clubs]);

  useEffect(() => {
    localStorage.setItem('tournament_groups', JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem('tournament_fixtures', JSON.stringify(fixtures));
  }, [fixtures]);

  useEffect(() => {
    localStorage.setItem('tournament_bracketMatches', JSON.stringify(bracketMatches));
  }, [bracketMatches]);

  useEffect(() => {
    localStorage.setItem('tournament_hallOfFame', JSON.stringify(hallOfFame));
  }, [hallOfFame]);

  // Derived State: Calculate Standings
  const groupStandings = useMemo(() => {
    const standings: Record<string, any[]> = {};
    groups.forEach(g => {
      standings[g.id] = g.clubIds.map((clubId: string) => ({
        clubId, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0
      }));
    });

    const allMatches = fixtures.flatMap(md => md.matches);

    allMatches.forEach((match: any) => {
      if (match.status !== 'played') return;
      const gStandings = standings[match.groupId];
      if (!gStandings) return;
      
      const hStats = gStandings.find(s => s.clubId === match.homeId);
      const aStats = gStandings.find(s => s.clubId === match.awayId);
      
      if (!hStats || !aStats) return;

      hStats.played++; aStats.played++;
      hStats.gf += match.homeScore; aStats.gf += match.awayScore;
      hStats.ga += match.awayScore; aStats.ga += match.homeScore;
      hStats.gd = hStats.gf - hStats.ga;
      aStats.gd = aStats.gf - aStats.ga;

      if (match.homeScore > match.awayScore) {
        hStats.won++; hStats.pts += 3;
        aStats.lost++;
      } else if (match.homeScore < match.awayScore) {
        aStats.won++; aStats.pts += 3;
        hStats.lost++;
      } else {
        hStats.drawn++; aStats.drawn++;
        hStats.pts += 1; aStats.pts += 1;
      }
    });

    // Sort Standings
    Object.keys(standings).forEach(groupId => {
      standings[groupId].sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      });
    });

    return standings;
  }, [fixtures, groups]);

  const areAllGroupMatchesPlayed = useMemo(() => {
    if (fixtures.length === 0) return false;
    const allMatches = fixtures.flatMap(md => md.matches);
    return allMatches.length > 0 && allMatches.every((f: any) => f.status === 'played');
  }, [fixtures]);

  const handleCreateTournament = (name: string) => {
    setTournamentName(name);
    setActiveTab('clubs');
  };

  const handleReset = () => {
    localStorage.removeItem('tournament_name');
    localStorage.removeItem('tournament_clubs');
    localStorage.removeItem('tournament_groups');
    localStorage.removeItem('tournament_fixtures');
    localStorage.removeItem('tournament_bracketMatches');
    localStorage.removeItem('tournament_view');
    localStorage.removeItem('tournament_activeTab');

    setTournamentName(null);
    setClubs([]);
    setGroups(INITIAL_GROUPS);
    setFixtures([]);
    setBracketMatches([]);
    setActiveTab('clubs');
    setView('home');
  };

  const generateFixtures = async (options: { within: boolean, between: boolean, rounds: number }) => {
    setIsGeneratingFixtures(true);
    setFixtureError(null);

    // If they chose AI mode, let's trigger the backend API
    if (schedulingMode === 'ai') {
      try {
        const response = await fetch("/api/generate-fixtures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clubs, groups, options }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Failed to make server-side AI call.");
        }

        const data = await response.json();
        if (data.matchdays && data.matchdays.length > 0) {
          setFixtures(data.matchdays);
          setActiveTab('fixtures');
          setIsGeneratingFixtures(false);
          return;
        } else {
          throw new Error("Invalid format returned from AI scheduling.");
        }
      } catch (err: any) {
        console.warn("AI generation failed, falling back to smart mathematical scheduling:", err.message);
        setFixtureError(`AI generation failed (${err.message}). Automatically fell back to mathematically optimized round-robin.`);
        // Fall back to algorithmic scheduling below
      }
    }

    // Mathematical Circle Method (Round-Robin) Generator
    const matchdays: any[] = [];
    let currentMatchdayIdx = 1;

    // 1. Within-Group Matches (Mathematically Spaced out)
    if (options.within) {
      const groupsRounds: any[][][] = []; // groupsRounds[group_idx][round_idx] = Array of matches

      groups.forEach(group => {
        const ids = group.clubIds;
        if (ids.length < 2) return;

        const list = [...ids];
        if (list.length % 2 !== 0) {
          list.push('BYE'); // Pad with bye for odd team count
        }
        const n = list.length;
        const expandedRounds: any[][] = [];

        for (let r = 0; r < options.rounds; r++) {
          let currentList = [...list];
          for (let roundIdx = 0; roundIdx < n - 1; roundIdx++) {
            const roundMatches: any[] = [];
            for (let i = 0; i < n / 2; i++) {
              const home = currentList[i];
              const away = currentList[n - 1 - i];
              if (home !== 'BYE' && away !== 'BYE') {
                const homeTeam = r % 2 === 0 ? home : away;
                const awayTeam = r % 2 === 0 ? away : home;
                roundMatches.push({
                  id: generateId(),
                  type: 'within',
                  groupId: group.id,
                  homeId: homeTeam,
                  awayId: awayTeam,
                  homeScore: 0,
                  awayScore: 0,
                  status: 'scheduled',
                  round: r * (n - 1) + roundIdx + 1
                });
              }
            }
            expandedRounds.push(roundMatches);
            // Rotate list elements (Circle Method, keeping first item fixed)
            currentList = [currentList[0], currentList[n - 1], ...currentList.slice(1, n - 1)];
          }
        }
        groupsRounds.push(expandedRounds);
      });

      // Merge group rounds into global Matchdays
      if (groupsRounds.length > 0) {
        const maxRounds = Math.max(...groupsRounds.map(gr => gr.length));
        for (let roundIdx = 0; roundIdx < maxRounds; roundIdx++) {
          const matchesForThisDay: any[] = [];
          groupsRounds.forEach(gr => {
            if (gr[roundIdx]) {
              matchesForThisDay.push(...gr[roundIdx]);
            }
          });
          if (matchesForThisDay.length > 0) {
            matchdays.push({
              id: generateId(),
              label: `Matchday ${currentMatchdayIdx} (Groups)`,
              matches: matchesForThisDay
            });
            currentMatchdayIdx++;
          }
        }
      }
    }

    // 2. Inter-group Bipartite Round-Robin Matches
    if (options.between && groups.length > 1) {
      for (let gIdx = 0; gIdx < groups.length - 1; gIdx += 2) {
        const groupA = groups[gIdx];
        const groupB = groups[gIdx + 1];
        if (!groupB) break;

        const listA = [...groupA.clubIds];
        const listB = [...groupB.clubIds];
        const size = Math.max(listA.length, listB.length);
        while (listA.length < size) listA.push('BYE');
        while (listB.length < size) listB.push('BYE');

        const expandedInterRounds: any[][] = [];
        for (let r = 0; r < options.rounds; r++) {
          for (let round = 0; round < size; round++) {
            const roundMatches: any[] = [];
            for (let i = 0; i < size; i++) {
              const teamA = listA[i];
              const teamB = listB[(i + round) % size];
              if (teamA !== 'BYE' && teamB !== 'BYE') {
                const homeTeam = r % 2 === 0 ? teamA : teamB;
                const awayTeam = r % 2 === 0 ? teamB : teamA;
                roundMatches.push({
                  id: generateId(),
                  type: 'between',
                  groupId: groupA.id, 
                  homeId: homeTeam,
                  awayId: awayTeam,
                  homeScore: 0,
                  awayScore: 0,
                  status: 'scheduled',
                  round: r * size + round + 1
                });
              }
            }
            expandedInterRounds.push(roundMatches);
          }
        }

        expandedInterRounds.forEach((roundMatches) => {
          if (roundMatches.length > 0) {
            matchdays.push({
              id: generateId(),
              label: `Matchday ${currentMatchdayIdx} (Inter-Group Rivals)`,
              matches: roundMatches
            });
            currentMatchdayIdx++;
          }
        });
      }
    }

    setFixtures(matchdays);
    setActiveTab('fixtures');
    setIsGeneratingFixtures(false);
  };

  const generateBracket = () => {
    // Top 2 from each group
    const playoffTeams: any[] = [];
    groups.forEach(g => {
      const gStandings = groupStandings[g.id];
      if (gStandings && gStandings.length >= 2) {
        playoffTeams.push({ groupId: g.id, rank: 1, clubId: gStandings[0].clubId });
        playoffTeams.push({ groupId: g.id, rank: 2, clubId: gStandings[1].clubId });
      }
    });

    if (playoffTeams.length < 4) return; // Need at least 2 groups semi-full

    // Quarter-Finals/Semi-Finals logic depends on number of teams
    // Simplified for now
    const qs = [];
    for(let i = 0; i < playoffTeams.length / 2; i++) {
        qs.push({ 
            id: generateId(), 
            type: 'KO', 
            team1: playoffTeams[i], 
            team2: playoffTeams[playoffTeams.length - 1 - i], 
            score1: 0, 
            score2: 0, 
            winner: null 
        });
    }

    setBracketMatches(qs);
  };

  const deleteFromHallOfFame = (id: string) => {
    setHallOfFame(hallOfFame.filter((h: any) => h.id !== id));
  };

  const updateHallOfFame = (updatedEntry: any) => {
    setHallOfFame(hallOfFame.map((h: any) => h.id === updatedEntry.id ? updatedEntry : h));
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans selection:bg-indigo-500/30">
      {/* Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="flex items-center space-x-2 text-2xl font-display font-bold text-white cursor-pointer"
            onClick={() => setView('home')}
          >
            <Trophy className="w-8 h-8 text-indigo-500 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
            <span className="tracking-tight">Tourney<span className="text-indigo-500">Premium</span></span>
          </motion.div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button 
              onClick={() => setView('hallOfFame')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center ${view === 'hallOfFame' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
            >
              <History className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Hall of Fame</span>
            </button>
            <button 
              onClick={() => setView('arena')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center ${view === 'arena' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white hover:bg-slate-700 active:scale-95 shadow-lg shadow-black/20'}`}
            >
              Arena <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-4 sm:p-8">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[70vh] text-center"
            >
              <div className="relative mb-8">
                <Trophy className="w-24 h-24 text-indigo-500" />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }} 
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute -top-2 -right-2 bg-yellow-500 rounded-full p-2 border-4 border-slate-950"
                >
                  <Medal className="w-6 h-6 text-slate-950" />
                </motion.div>
              </div>
              <h1 className="text-5xl sm:text-7xl font-display font-black text-white mb-6 uppercase tracking-tighter">
                Manage Your <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-600">Ultimate League</span>
              </h1>
              <p className="text-xl text-slate-400 max-w-2xl mb-10 font-medium">
                The most intuitive platform to organize professional-grade football tournaments. Handles groups, scores, and brackets automatically.
              </p>
              <button 
                onClick={() => setView('arena')}
                className="group relative px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-xl shadow-2xl transition-all hover:-translate-y-1 active:translate-y-0"
              >
                <span className="relative z-10 flex items-center">
                  Get Started Now <ArrowUpRight className="ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-indigo-400 blur-2xl opacity-0 group-hover:opacity-30 transition-opacity" />
              </button>
            </motion.div>
          )}

          {view === 'hallOfFame' && (
            <HallOfFameView 
              hallOfFame={hallOfFame} 
              onAdd={(entry: any) => setHallOfFame([entry, ...hallOfFame])} 
              onDelete={deleteFromHallOfFame}
              onUpdate={updateHallOfFame}
            />
          )}

          {view === 'arena' && (
            !tournamentName ? (
              <CreateTournamentView onStart={handleCreateTournament} />
            ) : (
              <motion.div 
                key="arena-active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col gap-8"
              >
                {/* Header Info */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-800 shadow-inner">
                      <Trophy className="w-8 h-8 text-indigo-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-display font-extrabold text-white leading-tight">{tournamentName}</h2>
                      <div className="flex items-center gap-3 text-sm text-slate-500 font-medium mt-1">
                        <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {clubs.length} Clubs</span>
                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                        <span className="flex items-center gap-1.5"><LayoutGrid className="w-3.5 h-3.5" /> {groups.filter(g => g.clubIds.length > 0).length} Groups</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full lg:w-auto">
                    <button 
                      onClick={handleReset}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold transition-all border border-red-500/20 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Tournament
                    </button>
                  </div>
                </div>

                {/* Sub-navigation Tabs */}
                <div className="flex flex-col lg:flex-row gap-8">
                  <div className="lg:w-64 flex-shrink-0 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 snap-x">
                    <TabBtn active={activeTab === 'clubs'} onClick={() => setActiveTab('clubs')} icon={<Users className="w-4 h-4"/>} label="Clubs" count={clubs.length} />
                    <TabBtn 
                       active={activeTab === 'groups'} 
                       onClick={() => setActiveTab('groups')} 
                       icon={<LayoutGrid className="w-4 h-4"/>} 
                       label="Groups" 
                       disabled={clubs.length === 0} 
                    />
                    <TabBtn 
                       active={activeTab === 'fixtures'} 
                       onClick={() => setActiveTab('fixtures')} 
                       icon={<Calendar className="w-4 h-4"/>} 
                       label="Fixtures" 
                       disabled={groups.some(g => g.clubIds.length === 0) || clubs.length === 0} 
                    />
                    <TabBtn 
                      active={activeTab === 'standings'} 
                      onClick={() => setActiveTab('standings')} 
                      icon={<Medal className="w-4 h-4"/>} 
                      label="Standings" 
                      disabled={fixtures.length === 0}
                    />
                    <TabBtn 
                      active={activeTab === 'bracket'} 
                      onClick={() => setActiveTab('bracket')} 
                      icon={<Swords className="w-4 h-4"/>} 
                      label="Playoffs" 
                      disabled={!areAllGroupMatchesPlayed && fixtures.length > 0}
                    />
                  </div>

                  {/* Tab Content Panel */}
                  <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 lg:p-8 min-h-[600px] shadow-2xl relative overflow-hidden">
                    <AnimatePresence mode="wait">
                      {activeTab === 'clubs' && (
                        <ClubsTab 
                          key="tab-clubs" 
                          clubs={clubs} 
                          setClubs={setClubs} 
                          onNext={() => setActiveTab('groups')} 
                        />
                      )}
                      {activeTab === 'groups' && (
                        <GroupsTab 
                          key="tab-groups" 
                          clubs={clubs} 
                          groups={groups} 
                          setGroups={setGroups} 
                          onGenerate={generateFixtures}
                          schedulingMode={schedulingMode}
                          setSchedulingMode={setSchedulingMode}
                          isGenerating={isGeneratingFixtures}
                          error={fixtureError}
                        />
                      )}
                      {activeTab === 'fixtures' && (
                        <FixturesTab 
                          key="tab-fixtures" 
                          fixtures={fixtures} 
                          setFixtures={setFixtures} 
                          clubs={clubs} 
                          tournamentName={tournamentName}
                        />
                      )}
                      {activeTab === 'standings' && (
                        <StandingsTab 
                          key="tab-standings" 
                          standings={groupStandings} 
                          clubs={clubs} 
                          groups={groups} 
                          tournamentName={tournamentName}
                        />
                      )}
                      {activeTab === 'bracket' && (
                        <BracketTab 
                          key="tab-bracket" 
                          bracketMatches={bracketMatches} 
                          setBracketMatches={setBracketMatches}
                          generateBracket={generateBracket}
                          clubs={clubs}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function TabBtn({ active, onClick, icon, label, count, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl whitespace-nowrap transition-all snap-start ${
        active 
          ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' 
          : 'bg-slate-900/50 text-slate-500 hover:bg-slate-800 hover:text-slate-300 border border-transparent'
      } ${disabled ? 'opacity-30 cursor-not-allowed grayscale' : 'cursor-pointer'}`}
    >
      <div className="flex items-center gap-3">
        <span className={`${active ? 'text-white' : 'text-indigo-400'} transition-colors`}>{icon}</span>
        <span className="font-bold text-sm uppercase tracking-wider">{label}</span>
      </div>
      {count !== undefined && !disabled && (
        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${active ? 'bg-indigo-500/50 text-white' : 'bg-slate-950 text-slate-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function CreateTournamentView({ onStart }: any) {
  const [name, setName] = useState('');

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onStart(name.trim());
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center min-h-[60vh]"
    >
      <div className="bg-slate-900 border border-slate-800 p-10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] max-w-md w-full text-center relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-indigo-500 to-purple-500" />
        <div className="bg-slate-950 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-800 shadow-inner">
          <Trophy className="w-10 h-10 text-indigo-500" />
        </div>
        <h2 className="text-3xl font-display font-black text-white mb-2 uppercase italic tracking-tight">New Tournament</h2>
        <p className="text-slate-500 font-medium mb-8">Enter a name for your champion's league</p>
        
        <form onSubmit={handleStart} className="space-y-4">
          <input 
            autoFocus
            type="text" 
            placeholder="e.g. World Cup 2026"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl px-6 py-4 text-white font-bold text-lg focus:outline-none focus:border-indigo-600 transition-colors text-center placeholder:text-slate-700"
          />
          <button 
            type="submit"
            disabled={!name.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-indigo-600/20 active:scale-95 uppercase tracking-widest text-sm"
          >
            Create & Enter
          </button>
        </form>
      </div>
    </motion.div>
  );
}

function ClubsTab({ clubs, setClubs, onNext }: any) {
  const [newClubName, setNewClubName] = useState('');
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddClub = () => {
    if (!newClubName.trim()) return;
    setClubs([...clubs, { 
      id: generateId(), 
      name: newClubName.trim(),
      logo: logoBase64 || undefined
    }]);
    setNewClubName('');
    setLogoBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeClub = (id: string) => {
    setClubs(clubs.filter((c: any) => c.id !== id));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex justify-between items-end border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight flex items-center gap-3">
            <Users className="w-6 h-6 text-indigo-500" /> Club Roster
          </h2>
          <p className="text-slate-500 text-sm mt-1">Register teams and upload logos (optional)</p>
        </div>
        {clubs.length >= 2 && (
          <button onClick={onNext} className="text-indigo-400 font-bold text-sm flex items-center hover:text-indigo-300 transition-colors">
            Next: Setup Groups <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex gap-2">
             <div 
               onClick={() => fileInputRef.current?.click()}
               className="w-14 h-14 bg-slate-950 border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors overflow-hidden flex-shrink-0"
             >
               {logoBase64 ? (
                 <img src={logoBase64} alt="Logo Preview" className="w-full h-full object-cover" />
               ) : (
                 <Camera className="w-5 h-5 text-slate-700" />
               )}
               <input 
                 ref={fileInputRef}
                 type="file" 
                 accept="image/*" 
                 onChange={handleLogoUpload} 
                 className="hidden" 
               />
             </div>
             <input 
              type="text"
              value={newClubName}
              onChange={(e) => setNewClubName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddClub()}
              placeholder="Club name (e.g. Real Madrid)"
              className="flex-1 bg-slate-950 border-2 border-slate-800 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:border-indigo-600 transition-colors"
            />
          </div>
          <button 
            onClick={handleAddClub} 
            className="bg-indigo-600 hover:bg-indigo-500 px-8 py-4 rounded-2xl font-black text-white active:scale-95 transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center"
          >
            <Plus className="w-5 h-5 mr-1" /> Add Team
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {clubs.map((club: any, idx: number) => (
          <motion.div 
            key={club.id} 
            initial={{ opacity: 0, x: -10 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ delay: idx * 0.05 }}
            className="group bg-slate-950 p-4 rounded-2xl flex justify-between items-center border border-slate-800 hover:border-indigo-500/50 transition-all shadow-lg hover:shadow-indigo-500/5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center overflow-hidden border border-slate-800">
                {club.logo ? (
                  <img src={club.logo} alt={club.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-black text-slate-600 uppercase text-xs">{club.name.substring(0, 2)}</span>
                )}
              </div>
              <span className="font-bold text-white tracking-tight">{club.name}</span>
            </div>
            <button 
              onClick={() => removeClub(club.id)} 
              className="text-slate-600 hover:text-red-500 p-2 hover:bg-red-500/10 rounded-xl transition-all lg:opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
        {clubs.length === 0 && (
          <div className="col-span-full py-20 text-center flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-slate-950 rounded-[2rem] flex items-center justify-center border border-slate-800">
              <Users className="w-10 h-10 text-slate-800" />
            </div>
            <p className="text-slate-600 font-bold max-w-[200px]">Add at least 2 clubs to begin forming groups.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function GroupsTab({ clubs, groups, setGroups, onGenerate, schedulingMode, setSchedulingMode, isGenerating, error }: any) {
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const [numGroups, setNumGroups] = useState(groups.length || 2);
  
  const [fixtureConfig, setFixtureConfig] = useState({ within: true, between: false, rounds: 1 });

  const getAssignedClubIds = () => groups.flatMap((g: any) => g.clubIds);
  const unassignedClubs = clubs.filter((c: any) => !getAssignedClubIds().includes(c.id));

  const handleNumGroupsChange = (n: number) => {
    setNumGroups(n);
    const newGroups = Array.from({ length: n }).map((_, i) => ({
      id: `group_${String.fromCharCode(97 + i)}`,
      name: `Group ${String.fromCharCode(65 + i)}`,
      clubIds: []
    }));
    setGroups(newGroups);
  };

  const assignToGroup = (groupId: string, clubId: string) => {
    setGroups(groups.map((g: any) => {
      if (g.id === groupId) {
        return { ...g, clubIds: [...g.clubIds, clubId] };
      }
      return g;
    }));
    setSelectedClub(null);
  };

  const removeFromGroup = (groupId: string, clubId: string) => {
    setGroups(groups.map((g: any) => {
      if (g.id === groupId) {
        return { ...g, clubIds: g.clubIds.filter((id: string) => id !== clubId) };
      }
      return g;
    }));
  };

  const autoStagger = () => {
    const newGroups = groups.map((g: any) => ({ ...g, clubIds: [] }));
    const clubsCopy = [...clubs];
    let gIdx = 0;
    while(clubsCopy.length > 0) {
      const cIdx = Math.floor(Math.random() * clubsCopy.length);
      const club = clubsCopy.splice(cIdx, 1)[0];
      newGroups[gIdx % newGroups.length].clubIds.push(club.id);
      gIdx++;
    }
    setGroups(newGroups);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 relative">
      {isGenerating && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-3xl min-h-[600px] gap-4">
          <div className="w-16 h-16 bg-slate-900 border border-indigo-500/50 rounded-2xl flex items-center justify-center animate-spin">
             <RefreshCw className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-white font-black uppercase text-sm tracking-widest animate-pulse">
            {schedulingMode === 'ai' ? 'Consulting Gemini AI Scheduler...' : 'Structuring Perfect Tournament Rounds...'}
          </p>
          <p className="text-slate-500 text-xs text-center max-w-xs leading-relaxed">
            {schedulingMode === 'ai' ? 'Organizing thematic matches, assuring no same-day club duplicates' : 'Running optimized circle-method scheduling algorithms'}
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight flex items-center gap-3">
            <LayoutGrid className="w-6 h-6 text-indigo-500" /> Group Setup
          </h2>
          <p className="text-slate-500 text-sm mt-1">Configure groups and assign teams</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
             <span className="text-[10px] font-black text-slate-500 uppercase">Groups:</span>
             <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button 
                    key={n}
                    onClick={() => handleNumGroupsChange(n)}
                    className={`w-7 h-7 rounded-lg text-xs font-black transition-all ${numGroups === n ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}
                  >
                    {n}
                  </button>
                ))}
             </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-4 rounded-2xl text-xs font-bold leading-relaxed flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-8">
        {/* Pool of Unassigned Clubs */}
        <div className="xl:w-64 flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">Pool Area</h4>
            <button onClick={autoStagger} className="text-[10px] font-black text-indigo-400 uppercase hover:text-indigo-300">Auto</button>
          </div>
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 min-h-[300px] flex flex-col gap-2 max-h-[500px] overflow-y-auto">
            {unassignedClubs.map((club: any) => (
              <button 
                key={club.id}
                onClick={() => setSelectedClub(selectedClub === club.id ? null : club.id)}
                className={`w-full text-left p-3 rounded-xl font-bold text-sm transition-all border ${
                  selectedClub === club.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'
                }`}
              >
                {club.name}
              </button>
            ))}
            {unassignedClubs.length === 0 && (
              <p className="text-center text-slate-700 text-xs font-bold pt-10">All clubs assigned</p>
            )}
          </div>
        </div>

        {/* Groups Display */}
        <div className="flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group: any) => (
              <div 
                key={group.id} 
                className={`bg-slate-950 rounded-2xl border p-4 transition-all ${
                  selectedClub ? 'border-indigo-500/50 cursor-pointer shadow-[0_0_20px_rgba(99,102,241,0.1)]' : 'border-slate-800 shadow-xl'
                }`}
                onClick={() => selectedClub && assignToGroup(group.id, selectedClub)}
              >
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-900">
                  <span className="font-display font-black text-white italic tracking-tighter uppercase">{group.name}</span>
                  <span className="bg-slate-900 text-slate-500 px-2.5 py-1 rounded-lg font-black text-[10px]">{group.clubIds.length} Teams</span>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {group.clubIds.map((id: string) => {
                    const club = clubs.find((c: any) => c.id === id);
                    return (
                      <div key={id} className="bg-slate-900 p-2.5 rounded-xl flex justify-between items-center group/item">
                         <span className="text-sm font-bold text-slate-300">{club?.name}</span>
                         <button 
                           onClick={(e) => { e.stopPropagation(); removeFromGroup(group.id, id); }}
                           className="text-slate-600 hover:text-red-500 p-1 transition-opacity"
                         >
                           <Trash2 className="w-3.5 h-3.5" />
                         </button>
                      </div>
                    );
                  })}
                  {group.clubIds.length === 0 && (
                    <div className="h-full flex items-center justify-center text-slate-800 text-[10px] uppercase font-bold tracking-widest border-2 border-dashed border-slate-900 rounded-xl py-6">
                      {selectedClub ? 'Drop Here' : 'Empty Group'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Fixture Generation Config */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-2xl">
              <h3 className="text-lg font-display font-black text-white uppercase italic mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-500" /> Fixture Generation Options
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <button 
                    onClick={() => setFixtureConfig(prev => ({ ...prev, within: !prev.within }))}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${fixtureConfig.within ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-600'}`}
                  >
                    <Users className="w-6 h-6 mb-2" />
                    <span className="font-bold text-xs uppercase">Within Groups</span>
                  </button>
                  <button 
                    onClick={() => setFixtureConfig(prev => ({ ...prev, between: !prev.between }))}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${fixtureConfig.between ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-600'}`}
                  >
                    <ArrowRightLeft className="w-6 h-6 mb-2" />
                    <span className="font-bold text-xs uppercase">Between Groups</span>
                  </button>
                  <div className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 bg-slate-950 border-slate-800">
                    <span className="text-[10px] font-black text-slate-500 uppercase mb-2">Rounds</span>
                    <div className="flex gap-2">
                        {[1, 2, 3].map(r => (
                            <button
                                key={r}
                                onClick={() => setFixtureConfig(prev => ({ ...prev, rounds: r }))}
                                className={`w-8 h-8 rounded-lg font-black text-xs transition-all cursor-pointer ${fixtureConfig.rounds === r ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                  </div>

                  {/* Scheduling Engine Switcher */}
                  <div className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 bg-slate-950 border-slate-800">
                    <span className="text-[10px] font-black text-slate-500 uppercase mb-2">Scheduling Engine</span>
                    <div className="flex bg-slate-900 p-1 rounded-xl w-full">
                      <button 
                        onClick={() => setSchedulingMode('algorithmic')}
                        className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all whitespace-nowrap cursor-pointer ${schedulingMode === 'algorithmic' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        Math Round
                      </button>
                      <button 
                        onClick={() => setSchedulingMode('ai')}
                        className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${schedulingMode === 'ai' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-300 hover:text-slate-300'}`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> Gemini AI
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={() => onGenerate(fixtureConfig)}
                    disabled={unassignedClubs.length > 0 || clubs.length === 0 || (!fixtureConfig.within && !fixtureConfig.between)}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black rounded-2xl transition-all shadow-lg flex flex-col items-center justify-center col-span-full py-4 cursor-pointer active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      <span className="font-bold text-sm uppercase">Generate Fixtures</span>
                    </div>
                  </button>
              </div>
              {unassignedClubs.length > 0 && <p className="text-red-500 text-[10px] font-bold uppercase mt-4 text-center">Unassigned teams remain in pool!</p>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FixturesTab({ fixtures, setFixtures, clubs, tournamentName }: any) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [selectedMatchdayIdx, setSelectedMatchdayIdx] = useState<number>(0);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [exportType, setExportType] = useState<'png' | 'pdf' | null>(null);

  const updateScore = (matchdayId: string, fixtureId: string, side: 'home' | 'away', value: string) => {
    const val = parseInt(value) || 0;
    setFixtures(fixtures.map((md: any) => {
      if (md.id === matchdayId) {
        return {
          ...md,
          matches: md.matches.map((m: any) => {
            if (m.id === fixtureId) {
              return { ...m, [`${side}Score`]: val, status: 'played' };
            }
            return m;
          })
        };
      }
      return md;
    }));
  };

  const handleExport = async (type: 'png' | 'pdf') => {
    if (!exportRef.current) return;
    try {
        const canvas = await html2canvas(exportRef.current, { 
            backgroundColor: '#020617',
            scale: 2,
            useCORS: true,
            logging: false
        });
        const dataUrl = canvas.toDataURL('image/png');
        setPreviewImg(dataUrl);
        setExportType(type);

        if (type === 'png') {
            const link = document.createElement('a');
            link.download = `${tournamentName || 'Tournament'}_Fixtures.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(dataUrl);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${tournamentName || 'Tournament'}_Fixtures.pdf`);
        }
    } catch (err) {
        console.error('Export failed', err);
    }
  };

  const displayedFixtures = selectedMatchdayIdx === -1 
    ? fixtures 
    : (fixtures[selectedMatchdayIdx] ? [fixtures[selectedMatchdayIdx]] : []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      {/* Fallback Preview/Instructions Overlay Modal */}
      {previewImg && (
         <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 lg:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col gap-6 relative shadow-2xl">
               <button 
                  onClick={() => { setPreviewImg(null); setExportType(null); }}
                  className="absolute top-4 right-4 p-2 bg-slate-950/80 rounded-full border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
               >
                  <X className="w-4 h-4" />
               </button>
               <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-2xl flex items-center justify-center mx-auto border border-green-500/20">
                     <Check className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-display font-black text-white uppercase tracking-tight">Export Initiated</h3>
                  <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
                     Your {exportType?.toUpperCase()} document generation is ready. Since this application runs in a secure sandboxed preview iframe, browser policies might block immediate direct downloads.
                  </p>
               </div>
               
               <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col gap-3">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">High Resolution Preview</span>
                  <img src={previewImg} className="max-h-[250px] object-contain rounded-lg border border-slate-800 mx-auto" alt="Generated Preview" />
                  <p className="text-indigo-400 text-[11px] font-bold text-center leading-relaxed">
                    💡 HELPFUL EXTRA TIP: If your browser block-shield is up, simply right-click on the image above and click "Save Image As...", or open this app in a separate tab to trigger standard click-to-downloads!
                  </p>
               </div>
               
               <div className="flex gap-2 w-full">
                  <button 
                     onClick={() => { setPreviewImg(null); setExportType(null); }}
                     className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl text-xs uppercase cursor-pointer"
                  >
                     Got It, Return To Arena
                  </button>
               </div>
            </div>
         </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight flex items-center gap-3">
            <Calendar className="w-6 h-6 text-indigo-500" /> Match Board
          </h2>
          <p className="text-slate-500 text-sm mt-1">Manage scores and export fixture list</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
            <button 
                onClick={() => handleExport('png')}
                className="flex-1 bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold px-4 py-3 rounded-xl border border-slate-800 text-[10px] uppercase flex items-center justify-center gap-2 cursor-pointer"
            >
                <ImageIcon className="w-3.5 h-3.5" /> PNG
            </button>
            <button 
                onClick={() => handleExport('pdf')}
                className="flex-1 bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold px-4 py-3 rounded-xl border border-slate-800 text-[10px] uppercase flex items-center justify-center gap-2 cursor-pointer"
            >
                <FileText className="w-3.5 h-3.5" /> PDF
            </button>
        </div>
      </div>

      {/* Segmented Matchday Menu Browser */}
      {fixtures.length > 0 && (
        <div className="flex flex-col gap-3 bg-slate-950 border border-slate-800/60 p-4 rounded-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Matchday Navigator</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Focus on one round of play or review the entire card.</p>
            </div>
            <button 
              onClick={() => setSelectedMatchdayIdx(-1)}
              className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase border transition-all cursor-pointer ${selectedMatchdayIdx === -1 ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
            >
              All Matchdays
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
             {fixtures.map((md: any, idx: number) => (
                <button
                  key={md.id}
                  onClick={() => setSelectedMatchdayIdx(idx)}
                  className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all snap-start shrink-0 border cursor-pointer ${selectedMatchdayIdx === idx ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/20' : 'bg-slate-900 border-slate-800/40 text-slate-500 hover:text-slate-300'}`}
                >
                  {md.label}
                </button>
             ))}
          </div>
        </div>
      )}

      <div ref={exportRef} className="space-y-12 p-4 bg-slate-950 rounded-3xl">
        {displayedFixtures.map((md: any) => (
          <div key={md.id} className="space-y-4">
             <div className="flex items-center gap-4">
                <span className="bg-indigo-600 text-white font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">
                  {md.label}
                </span>
                <div className="h-px bg-slate-800 flex-1" />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {md.matches.map((f: any) => {
                  const home = clubs.find((c: any) => c.id === f.homeId);
                  const away = clubs.find((c: any) => c.id === f.awayId);
                  return (
                    <div key={f.id} className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 shadow-xl group hover:border-indigo-500/50 transition-all">
                       <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-4">
                             <div className="flex flex-col gap-3 flex-1 min-w-0">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className="w-6 h-6 bg-slate-950 rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-800">
                                        {home?.logo ? <img src={home.logo} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span className="text-[8px] text-slate-600 font-black">{home?.name.substring(0, 1)}</span>}
                                    </div>
                                    <span className="text-xs font-bold text-slate-300 truncate uppercase">{home?.name}</span>
                                </div>
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className="w-6 h-6 bg-slate-950 rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-800">
                                        {away?.logo ? <img src={away.logo} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span className="text-[8px] text-slate-600 font-black">{away?.name.substring(0, 1)}</span>}
                                    </div>
                                    <span className="text-xs font-bold text-slate-300 truncate uppercase">{away?.name}</span>
                                </div>
                             </div>
                             <div className="flex flex-col gap-2">
                                <input 
                                  type="number" 
                                  value={f.homeScore} 
                                  onChange={(e) => updateScore(md.id, f.id, 'home', e.target.value)}
                                  className="w-10 h-8 bg-slate-950 rounded-lg text-center font-black text-white border border-slate-800 focus:border-indigo-500 transition-colors"
                                />
                                <input 
                                  type="number" 
                                  value={f.awayScore} 
                                  onChange={(e) => updateScore(md.id, f.id, 'away', e.target.value)}
                                  className="w-10 h-8 bg-slate-950 rounded-lg text-center font-black text-white border border-slate-800 focus:border-indigo-500 transition-colors"
                                />
                             </div>
                          </div>
                       </div>
                    </div>
                  );
                })}
             </div>
          </div>
        ))}
        {fixtures.length === 0 && (
          <div className="py-20 text-center text-slate-600 font-bold">No fixtures generated yet.</div>
        )}
      </div>
    </motion.div>
  );
}

function StandingsTab({ standings, clubs, groups, tournamentName }: any) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [exportType, setExportType] = useState<'png' | 'pdf' | null>(null);

  const handleExport = async (type: 'png' | 'pdf') => {
    if (!exportRef.current) return;
    try {
        const canvas = await html2canvas(exportRef.current, { 
            backgroundColor: '#020617',
            scale: 2,
            useCORS: true,
            logging: false
        });
        const dataUrl = canvas.toDataURL('image/png');
        setPreviewImg(dataUrl);
        setExportType(type);

        if (type === 'png') {
            const link = document.createElement('a');
            link.download = `${tournamentName || 'Tournament'}_Standings.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            const pdf = new jsPDF('l', 'mm', 'a4'); 
            const imgProps = pdf.getImageProperties(dataUrl);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${tournamentName || 'Tournament'}_Standings.pdf`);
        }
    } catch (err) {
        console.error('Export failed', err);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      {/* Fallback Preview/Instructions Overlay Modal */}
      {previewImg && (
         <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 lg:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col gap-6 relative shadow-2xl">
               <button 
                  onClick={() => { setPreviewImg(null); setExportType(null); }}
                  className="absolute top-4 right-4 p-2 bg-slate-950/80 rounded-full border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
               >
                  <X className="w-4 h-4" />
               </button>
               <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-2xl flex items-center justify-center mx-auto border border-green-500/20">
                     <Check className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-display font-black text-white uppercase tracking-tight">Export Initiated</h3>
                  <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
                     Your standings sheet {exportType?.toUpperCase()} document is ready. Since this application runs in a secure sandboxed preview iframe, browser policies might block immediate direct downloads.
                  </p>
               </div>
               
               <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col gap-3">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">High Resolution Standings Preview</span>
                  <img src={previewImg} className="max-h-[250px] object-contain rounded-lg border border-slate-800 mx-auto" alt="Generated Standings Preview" />
                  <p className="text-indigo-400 text-[11px] font-bold text-center leading-relaxed">
                    💡 HELPFUL EXTRA TIP: If your browser block-shield is up, simply right-click on the image above and click "Save Image As...", or open this app in a separate tab to trigger standard click-to-downloads!
                  </p>
               </div>
               
               <div className="flex gap-2 w-full">
                  <button 
                     onClick={() => { setPreviewImg(null); setExportType(null); }}
                     className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl text-xs uppercase cursor-pointer"
                  >
                     Got It, Return To Standings
                  </button>
               </div>
            </div>
         </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight flex items-center justify-center lg:justify-start gap-3">
            <Medal className="w-6 h-6 text-indigo-500" /> Group Tables
          </h2>
          <p className="text-slate-500 text-sm mt-1">Real-time standings based on match scores</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
            <button 
                onClick={() => handleExport('png')}
                className="flex-1 bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold px-4 py-3 rounded-xl border border-slate-800 text-[10px] uppercase flex items-center justify-center gap-2 cursor-pointer"
            >
                <ImageIcon className="w-3.5 h-3.5" /> PNG
            </button>
            <button 
                onClick={() => handleExport('pdf')}
                className="flex-1 bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold px-4 py-3 rounded-xl border border-slate-800 text-[10px] uppercase flex items-center justify-center gap-2 cursor-pointer"
            >
                <FileText className="w-3.5 h-3.5" /> PDF
            </button>
        </div>
      </div>

      <div ref={exportRef} className="grid grid-cols-1 xl:grid-cols-2 gap-8 p-4 bg-slate-950 rounded-3xl">
        {groups.map((group: any) => (
          <div key={group.id} className="bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl rounded-2xl">
             <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
                <span className="font-display font-black text-white italic uppercase tracking-tighter">{group.name}</span>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Stage 1</span>
             </div>
             <div className="overflow-x-auto">
             <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                   <tr className="border-b border-slate-800 bg-slate-900/50">
                      <th className="p-4 font-black text-slate-600 uppercase">#</th>
                      <th className="p-4 font-black text-slate-600 uppercase min-w-[120px]">Team</th>
                      <th className="p-4 font-black text-slate-600 uppercase text-center" title="Matches Played">MP</th>
                      <th className="p-4 font-black text-slate-600 uppercase text-center" title="Won">W</th>
                      <th className="p-4 font-black text-slate-600 uppercase text-center" title="Draw">D</th>
                      <th className="p-4 font-black text-slate-600 uppercase text-center" title="Lost">L</th>
                      <th className="p-4 font-black text-slate-600 uppercase text-center" title="Goals For">GF</th>
                      <th className="p-4 font-black text-slate-600 uppercase text-center" title="Goals Against">GA</th>
                      <th className="p-4 font-black text-slate-600 uppercase text-center" title="Goal Difference">GD</th>
                      <th className="p-4 font-black text-white uppercase text-center bg-indigo-500/10">Pts</th>
                   </tr>
                </thead>
                <tbody>
                   {standings[group.id]?.map((row: any, idx: number) => {
                      const club = clubs.find((c: any) => c.id === row.clubId);
                      return (
                        <tr key={row.clubId} className={`border-b border-slate-800 group ${idx < 2 ? 'bg-indigo-500/[0.05]' : ''}`}>
                           <td className="p-4">
                              <span className={`w-6 h-6 flex items-center justify-center rounded-lg font-black text-[10px] ${idx < 2 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                {idx + 1}
                              </span>
                           </td>
                           <td className="p-4 flex items-center gap-3">
                              <div className="w-6 h-6 bg-slate-950 rounded flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-800">
                                {club?.logo ? <img src={club.logo} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px] text-slate-600 font-black">{club?.name.substring(0, 1)}</span>}
                              </div>
                              <span className="font-bold text-slate-200">{club?.name}</span>
                           </td>
                           <td className="p-4 text-center text-slate-400 font-medium">{row.played}</td>
                           <td className="p-4 text-center text-slate-500 font-medium">{row.won}</td>
                           <td className="p-4 text-center text-slate-500 font-medium">{row.drawn}</td>
                           <td className="p-4 text-center text-slate-500 font-medium">{row.lost}</td>
                           <td className="p-4 text-center text-slate-500 font-medium">{row.gf}</td>
                           <td className="p-4 text-center text-slate-500 font-medium">{row.ga}</td>
                           <td className={`p-4 text-center font-bold ${row.gd > 0 ? 'text-green-500' : row.gd < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                              {row.gd > 0 ? `+${row.gd}` : row.gd}
                           </td>
                           <td className="p-4 text-center bg-indigo-500/[0.03]">
                              <span className="font-black text-white text-base">{row.pts}</span>
                           </td>
                        </tr>
                      );
                   })}
                   {(!standings[group.id] || standings[group.id].length === 0) && (
                     <tr>
                        <td colSpan={10} className="p-10 text-center text-slate-700 font-bold uppercase tracking-widest">No data</td>
                     </tr>
                   )}
                </tbody>
             </table>
             </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function BracketTab({ bracketMatches, setBracketMatches, generateBracket, clubs }: any) {
  const updateBracketScore = (matchId: string, side: 'score1' | 'score2', value: string) => {
    const val = parseInt(value) || 0;
    setBracketMatches(bracketMatches.map((m: any) => {
      if (m.id === matchId) {
        const newScore1 = side === 'score1' ? val : m.score1;
        const newScore2 = side === 'score2' ? val : m.score2;
        let winner = null;
        if (newScore1 > newScore2) winner = m.team1;
        else if (newScore2 > newScore1) winner = m.team2;
        return { ...m, score1: newScore1, score2: newScore2, winner };
      }
      return m;
    }));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight flex items-center gap-3">
            <Swords className="w-6 h-6 text-indigo-500" /> Playoff Stage
          </h2>
          <p className="text-slate-500 text-sm mt-1">Single elimination bracket generated from standings</p>
        </div>
        {bracketMatches.length === 0 && (
          <button 
             onClick={generateBracket}
             className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 py-4 rounded-2xl transition-all shadow-xl active:scale-95 text-xs uppercase"
          >
            Generate Playoff Draw
          </button>
        )}
      </div>

      {bracketMatches.length > 0 ? (
        <div className="space-y-12">
            <div className="flex items-center gap-4">
              <span className="bg-slate-900 border border-slate-800 text-slate-300 font-black text-[10px] px-4 py-1.5 rounded-full uppercase tracking-widest">
                Bracket Matches
              </span>
              <div className="h-px bg-slate-800 flex-1" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {bracketMatches.map(m => {
                  const team1 = clubs.find((c: any) => c.id === m.team1.clubId);
                  const team2 = clubs.find((c: any) => c.id === m.team2.clubId);
                  return (
                    <div key={m.id} className="relative group">
                       <div className={`p-1 rounded-[2rem] bg-gradient-to-br transition-all duration-500 ${m.winner ? 'from-indigo-500/50 to-purple-500/50' : 'from-slate-800/50 to-slate-800/50'}`}>
                          <div className="bg-slate-950 p-6 rounded-[1.8rem] border border-slate-900/50 flex items-center justify-between">
                             <div className="flex-1 space-y-4">
                                <div className={`flex items-center justify-between gap-4 transition-opacity ${m.winner === m.team2 ? 'opacity-40' : 'opacity-100'}`}>
                                  <span className="font-bold text-white text-sm uppercase truncate">{team1?.name}</span>
                                  <input 
                                    type="number" 
                                    value={m.score1} 
                                    onChange={(e) => updateBracketScore(m.id, 'score1', e.target.value)}
                                    className="w-12 h-10 bg-slate-900 rounded-xl text-center font-black text-lg text-white border border-slate-800 focus:border-indigo-500"
                                  />
                                </div>
                                <div className="h-px bg-slate-900" />
                                <div className={`flex items-center justify-between gap-4 transition-opacity ${m.winner === m.team1 ? 'opacity-40' : 'opacity-100'}`}>
                                  <span className="font-bold text-white text-sm uppercase truncate">{team2?.name}</span>
                                  <input 
                                    type="number" 
                                    value={m.score2} 
                                    onChange={(e) => updateBracketScore(m.id, 'score2', e.target.value)}
                                    className="w-12 h-10 bg-slate-900 rounded-xl text-center font-black text-lg text-white border border-slate-800 focus:border-indigo-500"
                                  />
                                </div>
                             </div>
                             {m.winner && (
                               <div className="ml-6 flex-shrink-0 animate-in zoom-in duration-500">
                                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/40">
                                     <Trophy className="w-6 h-6 text-white" />
                                  </div>
                                </div>
                             )}
                          </div>
                       </div>
                    </div>
                  );
               })}
            </div>
            
            <div className="bg-indigo-600/5 border border-indigo-500/20 p-8 rounded-[2.5rem] text-center border-dashed">
               <p className="text-indigo-400 font-black text-xs uppercase tracking-[0.3em]">Knockout Simulation</p>
               <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">Winners progress through the single elimination stages.</p>
            </div>
        </div>
      ) : (
        <div className="py-20 text-center flex flex-col items-center gap-4">
           <div className="w-20 h-20 bg-slate-950 rounded-[2rem] flex items-center justify-center border border-slate-800">
             <Swords className="w-10 h-10 text-slate-800" />
           </div>
           <p className="text-slate-600 font-bold max-w-[250px]">Finish group stage to unlock knockout generator.</p>
        </div>
      )}
    </motion.div>
  );
}

function HallOfFameView({ hallOfFame, onAdd, onDelete, onUpdate }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [season, setSeason] = useState('');
  const [winner, setWinner] = useState('');
  const [runnerUp, setRunnerUp] = useState('');

  const [editSeason, setEditSeason] = useState('');
  const [editWinner, setEditWinner] = useState('');
  const [editRunnerUp, setEditRunnerUp] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (season && winner && runnerUp) {
      onAdd({ id: generateId(), season, winner, runnerUp });
      setSeason('');
      setWinner('');
      setRunnerUp('');
      setShowAdd(false);
    }
  };

  const startEditing = (h: any) => {
    setEditingId(h.id);
    setEditSeason(h.season);
    setEditWinner(h.winner);
    setEditRunnerUp(h.runnerUp);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editSeason && editWinner && editRunnerUp) {
      onUpdate({ id: editingId, season: editSeason, winner: editWinner, runnerUp: editRunnerUp });
      setEditingId(null);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12 bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
        <div className="text-center md:text-left">
          <h2 className="text-4xl font-display font-black text-white uppercase italic tracking-tighter mb-2">Hall of Fame</h2>
          <p className="text-slate-500 font-medium">History of champions and legends</p>
        </div>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${showAdd ? 'bg-slate-800 text-slate-300' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500'}`}
        >
          {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAdd ? 'Cancel' : 'Add Record'}
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-12"
          >
            <div className="bg-slate-900 border border-indigo-500/30 p-8 rounded-[2.5rem] shadow-2xl">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Season Name</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. 2025 Winter"
                    value={season}
                    onChange={e => setSeason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-bold focus:border-indigo-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Winner Team</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Club Name"
                    value={winner}
                    onChange={e => setWinner(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-bold focus:border-indigo-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Runner-up Team</label>
                  <div className="flex gap-3">
                    <input 
                      required
                      type="text" 
                      placeholder="Club Name"
                      value={runnerUp}
                      onChange={e => setRunnerUp(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-bold focus:border-indigo-600 transition-colors"
                    />
                    <button 
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl shadow-lg transition-all"
                    >
                      <Check className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {hallOfFame.map((h: any, idx: number) => (
          <motion.div 
            key={h.id} 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group relative bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] overflow-hidden shadow-2xl hover:border-indigo-500/50 transition-all"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
               <Trophy className="w-32 h-32 text-indigo-400" />
            </div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <span className="inline-block bg-slate-950 text-indigo-400 font-black text-[10px] px-3 py-1 rounded-lg uppercase tracking-widest">
                   Season {h.season}
                </span>
                <div className="flex gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => startEditing(h)}
                    className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onDelete(h.id)}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {editingId === h.id ? (
                <form onSubmit={handleUpdate} className="space-y-4 pt-2">
                   <div className="space-y-3">
                      <input 
                        value={editSeason} 
                        onChange={e => setEditSeason(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-bold text-sm"
                        placeholder="Season"
                      />
                      <input 
                        value={editWinner} 
                        onChange={e => setEditWinner(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-bold text-sm"
                        placeholder="Winner"
                      />
                      <input 
                        value={editRunnerUp} 
                        onChange={e => setEditRunnerUp(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-bold text-sm"
                        placeholder="Runner-up"
                      />
                   </div>
                   <div className="flex gap-2 justify-end">
                      <button type="button" onClick={cancelEditing} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-xs font-bold uppercase">Cancel</button>
                      <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-indigo-500">Save</button>
                   </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                     <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Champions</p>
                     <h3 className="text-2xl font-display font-black text-white uppercase tracking-tight">{h.winner}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-8 h-8 rounded-full bg-slate-950 flex items-center justify-center border border-slate-800">
                        <Medal className="w-4 h-4 text-slate-500" />
                     </div>
                     <p className="text-slate-400 font-bold text-sm">Runner-up: <span className="text-white">{h.runnerUp}</span></p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
