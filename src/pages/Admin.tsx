import { useEffect, useState } from "react";
import { auth, db, googleProvider, handleFirestoreError, OperationType } from "../lib/firebase";
import { signInWithPopup, onAuthStateChanged, User, signOut } from "firebase/auth";
import { collection, onSnapshot, query, orderBy, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Section, SectionType, Profile } from "../types";
import { Plus, Trash2, LogOut, Loader2, ArrowLeft, GripVertical, AlertTriangle } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { cn } from "../lib/utils";

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [blockedIps, setBlockedIps] = useState<{ip: string}[]>([]);
  const [newBlockedIp, setNewBlockedIp] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user || user.email !== 'dikhyantsatpathy@gmail.com') return;
    const q = query(collection(db, "sections"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Section[];
      setSections(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, "sections"));
    
    // Fetch blocked IPs
    const qBlocked = query(collection(db, "blocked_ips"));
    const unsubscribeBlocked = onSnapshot(qBlocked, (snapshot) => {
      setBlockedIps(snapshot.docs.map(doc => ({ ip: doc.id })));
    }, (error) => console.error("Error fetching blocked IPs", error));
    
    // Fetch profile
    const unsubscribeProfile = onSnapshot(doc(db, "profiles", "main"), (docSnap) => {
      if (docSnap.exists()) {
        setProfile({ id: docSnap.id, ...docSnap.data() } as Profile);
      } else {
        // Initialize default profile
        setProfile({
          id: "main",
          name: "Dikhyant Satapathy",
          subtitle: "B.Tech CSIT Student & Developer",
          bio: "I am a student at ITER, SOA University, Odisha, with a passion for Web Design and Development and Cyber Security.\n\nMy technical curiosity has led me to work on various projects including hardware optimization, exploring Kali Linux, and full-stack development. I actively participate in tech communities and enjoy diving into rich narratives in my downtime.",
          skills: ["React.js", "Node.js", "TypeScript", "Python", "C/C++", "Java", "Tailwind CSS", "MongoDB", "Firebase", "System Design", "Cybersecurity", "Data Structures", "Git", "GitHub", "Linux"],
          interests: [
            { id: '1', title: 'Gaming & Cinematics', icon: 'gamepad', description: 'Lethal Company, Bigfoot, and Schedule 1. I also produce cinematic montages for games like God of War (2018) and Ghost of Tsushima.' },
            { id: '2', title: 'Cybersecurity', icon: 'shield', description: 'Actively exploring cybersecurity concepts using Kali Linux via VirtualBox, alongside hardware optimization for my HP Omen 16.' },
            { id: '3', title: 'Literature', icon: 'book', description: 'An avid bookworm who enjoys diving into novels, short stories, and rich narratives during my downtime.' },
            { id: '4', title: 'Coding & Development', icon: 'code', description: 'Building full-stack web applications, exploring new frameworks, and continuously learning software engineering principles.' },
          ],
          email: "dikhyantsatpathy@gmail.com",
          github: "@dikhyant",
          linkedin: "/in/dikhyant",
          twitter: "@dikhyant",
          location: "Odisha, India",
          ownerId: user.uid,
          updatedAt: new Date().toISOString()
        });
      }
    }, (error) => console.error("Error fetching profile", error));

    // Fetch messages
    const qMessages = query(collection(db, "messages"), orderBy("createdAt", "desc"));
    const unsubscribeMessages = onSnapshot(qMessages, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error fetching messages", error));
    
    // Fetch visitors
    const qVisitors = query(collection(db, "visitors"), orderBy("lastVisited", "desc"));
    const unsubscribeVisitors = onSnapshot(qVisitors, (snapshot) => {
      setVisitors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error fetching visitors", error));
    
    return () => {
      unsubscribe();
      unsubscribeBlocked();
      unsubscribeProfile();
      unsubscribeMessages();
      unsubscribeVisitors();
    };
  }, [user]);

  const handleUpdateProfile = async (updates: Partial<Profile>) => {
    if (!profile || !user) return;
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);
    try {
      await setDoc(doc(db, "profiles", "main"), {
        ...newProfile,
        ownerId: user.uid,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error(error);
      if (error?.code === 'auth/unauthorized-domain') {
        alert("Login Failed: This domain is not authorized. Please go to Firebase Console > Authentication > Settings > Authorized Domains and add this URL.");
      } else {
        alert(`Failed to login: ${error.message || "Unknown error"}`);
      }
    }
  };

  const handleCreateSection = async () => {
    if (!user) return;
    const newId = `sec_${Date.now()}`;
    const newSection: Section = {
      title: "New Section",
      type: "projects",
      items: [],
      order: sections.length,
      visible: false,
      updatedAt: new Date().toISOString(),
      ownerId: user.uid,
    };
    try {
      await setDoc(doc(db, "sections", newId), {
        ...newSection,
        updatedAt: serverTimestamp()
      });
      setEditingId(newId);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "sections");
    }
  };

  const handleDeleteSection = async (id: string) => {
    try {
      await deleteDoc(doc(db, "sections", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `sections/${id}`);
    }
  };

  const handleUpdateSection = async (id: string, data: Partial<Section>) => {
    try {
      await updateDoc(doc(db, "sections", id), {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sections/${id}`);
    }
  };

  const handleBlockIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockedIp.trim()) return;
    try {
      const cleanIp = newBlockedIp.trim().replace(/\//g, '-');
      await setDoc(doc(db, "blocked_ips", cleanIp), { blockedAt: serverTimestamp() });
      setNewBlockedIp("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnblockIp = async (ip: string) => {
    try {
      await deleteDoc(doc(db, "blocked_ips", ip));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex flex-col items-center justify-center p-6 text-center">
        <Link to="/" className="absolute top-8 left-8 text-gray-500 hover:text-white flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back to Site</Link>
        <div className="bg-[#141416] p-8 rounded-2xl border border-white/5 max-w-sm w-full space-y-6">
          <h1 className="text-2xl font-bold text-white">Admin Access</h1>
          <p className="text-gray-400 text-sm">Sign in with your authorized Google account to manage your portfolio.</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-white text-black font-semibold py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (user.email !== 'dikhyantsatpathy@gmail.com') {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex flex-col items-center justify-center p-6 text-center">
        <Link to="/" className="absolute top-8 left-8 text-gray-500 hover:text-white flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back to Site</Link>
        <div className="bg-[#141416] p-8 rounded-2xl border border-white/5 max-w-sm w-full space-y-6">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-white">Access Denied</h1>
          <p className="text-gray-400 text-sm">You do not have permission to access the admin panel. Logged in as: {user.email}</p>
          <button 
            onClick={() => signOut(auth)}
            className="w-full bg-white/10 text-white font-semibold py-3 px-4 rounded-xl hover:bg-white/20 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-gray-200 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex justify-between items-center bg-[#141416] p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-500 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <h1 className="text-xl font-bold text-white">Portfolio Dashboard</h1>
              <p className="text-sm text-gray-500">Manage your dynamic sections</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:block text-right">
              <p className="text-xs text-gray-500">Logged in as</p>
              <p className="text-sm font-medium text-white">{user.email}</p>
            </div>
            <button onClick={() => signOut(auth)} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </header>

        {/* Profile Management */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-white/5 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Profile Details</h2>
              <p className="text-sm text-gray-500">Customize your portfolio header and about info</p>
            </div>
          </div>
          {profile ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4 md:col-span-2">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name</label>
                  <input type="text" value={profile.name || ''} onChange={e => handleUpdateProfile({name: e.target.value})} className="w-full bg-[#0d0d0f] text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Subtitle</label>
                  <input type="text" value={profile.subtitle || ''} onChange={e => handleUpdateProfile({subtitle: e.target.value})} className="w-full bg-[#0d0d0f] text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Bio (About Me)</label>
                  <textarea value={profile.bio || ''} onChange={e => handleUpdateProfile({bio: e.target.value})} className="w-full bg-[#0d0d0f] text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none h-32 resize-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Skills (comma separated)</label>
                  <input type="text" value={profile.skills?.join(", ") || ""} onChange={e => handleUpdateProfile({skills: e.target.value.split(",").map(s => s.trim()).filter(Boolean)})} className="w-full bg-[#0d0d0f] text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none" />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input type="email" value={profile.email || ''} onChange={e => handleUpdateProfile({email: e.target.value})} className="w-full bg-[#0d0d0f] text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Location</label>
                  <input type="text" value={profile.location || ''} onChange={e => handleUpdateProfile({location: e.target.value})} className="w-full bg-[#0d0d0f] text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Education Info (e.g. Class of 2028)</label>
                  <input type="text" value={profile.educationInfo || ''} onChange={e => handleUpdateProfile({educationInfo: e.target.value})} className="w-full bg-[#0d0d0f] text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none" />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">GitHub Username</label>
                  <input type="text" value={profile.github || ''} onChange={e => handleUpdateProfile({github: e.target.value})} className="w-full bg-[#0d0d0f] text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">LinkedIn Path</label>
                  <input type="text" value={profile.linkedin || ''} onChange={e => handleUpdateProfile({linkedin: e.target.value})} className="w-full bg-[#0d0d0f] text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Twitter Username</label>
                  <input type="text" value={profile.twitter || ''} onChange={e => handleUpdateProfile({twitter: e.target.value})} className="w-full bg-[#0d0d0f] text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Institution</label>
                  <input type="text" value={profile.institution || ''} onChange={e => handleUpdateProfile({institution: e.target.value})} className="w-full bg-[#0d0d0f] text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none" />
                </div>
              </div>
              
              <div className="space-y-4 md:col-span-2 mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-md font-semibold text-white">Interests</h3>
                  <button 
                    onClick={() => {
                      const newInterests = [...(profile.interests || [])];
                      if (newInterests.length < 4) {
                        newInterests.push({ id: Date.now().toString(), title: '', description: '', icon: 'book' });
                        handleUpdateProfile({interests: newInterests});
                      } else {
                        alert("You can have up to 4 interests.");
                      }
                    }}
                    className="flex items-center gap-1 text-xs bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded hover:bg-indigo-500/30 transition-colors"
                  >
                    <Plus size={14} /> Add Interest
                  </button>
                </div>
                <p className="text-sm text-gray-500 mb-4">You can have up to 4 interests. Edit them below:</p>
                {profile.interests?.map((interest, idx) => (
                  <div key={interest.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#0a0a0c] p-4 rounded-xl border border-white/5 relative">
                    <button 
                      onClick={() => {
                        const newInterests = profile.interests?.filter(i => i.id !== interest.id);
                        handleUpdateProfile({interests: newInterests});
                      }}
                      className="absolute top-2 right-2 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Icon (gamepad, shield, book, code)</label>
                      <input type="text" value={interest.icon} onChange={e => {
                        const newInterests = [...(profile.interests || [])];
                        newInterests[idx].icon = e.target.value;
                        handleUpdateProfile({interests: newInterests});
                      }} className="w-full bg-[#141416] text-white border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Title</label>
                      <input type="text" value={interest.title} onChange={e => {
                        const newInterests = [...(profile.interests || [])];
                        newInterests[idx].title = e.target.value;
                        handleUpdateProfile({interests: newInterests});
                      }} className="w-full bg-[#141416] text-white border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none text-sm" />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs text-gray-400 mb-1">Description</label>
                      <textarea value={interest.description} onChange={e => {
                        const newInterests = [...(profile.interests || [])];
                        newInterests[idx].description = e.target.value;
                        handleUpdateProfile({interests: newInterests});
                      }} className="w-full bg-[#141416] text-white border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none text-sm h-20 resize-none" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Loading profile...</p>
          )}
        </div>

        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Sections</h2>
          <button 
            onClick={handleCreateSection}
            className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Section
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {sections.length === 0 && (
            <div className="text-center py-12 text-gray-500 border border-dashed border-white/10 rounded-2xl">
              No sections created yet. Add one to get started.
            </div>
          )}
          {sections.map(section => (
            <div key={section.id} className="bg-[#141416] p-6 rounded-2xl border border-white/5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="cursor-move text-gray-600"><GripVertical className="w-5 h-5" /></div>
                  <input 
                    type="text" 
                    value={section.title}
                    onChange={(e) => handleUpdateSection(section.id!, { title: e.target.value })}
                    className="bg-transparent text-lg font-medium text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 w-64"
                  />
                  <select 
                    value={section.type}
                    onChange={(e) => handleUpdateSection(section.id!, { type: e.target.value as SectionType })}
                    className="bg-[#0d0d0f] text-sm text-gray-300 border border-white/10 rounded-lg px-3 py-1 focus:outline-none"
                  >
                    <option value="projects">Projects</option>
                    <option value="achievements">Achievements</option>
                    <option value="certificates">Certificates</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={section.visible}
                      onChange={(e) => handleUpdateSection(section.id!, { visible: e.target.checked })}
                      className="rounded bg-black border-gray-600 text-indigo-500 focus:ring-indigo-500"
                    />
                    Visible
                  </label>
                  <button onClick={() => handleDeleteSection(section.id!)} className="text-gray-500 hover:text-red-400 p-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Items Management */}
              <div className="pl-9 pt-4 border-t border-white/5 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-gray-400">Items ({section.items?.length || 0})</h3>
                  <button 
                    onClick={() => {
                      const newItems = [...(section.items || []), { id: Date.now().toString(), title: "New Item" }];
                      handleUpdateSection(section.id!, { items: newItems });
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    + Add Item
                  </button>
                </div>
                
                <div className="space-y-3">
                  {section.items?.map((item, idx) => (
                    <div key={item.id} className="bg-[#0d0d0f] p-4 rounded-xl border border-white/5 space-y-3">
                      <div className="flex justify-between gap-4">
                        <input 
                          type="text" 
                          placeholder="Title" 
                          value={item.title}
                          onChange={(e) => {
                            const newItems = [...section.items];
                            newItems[idx].title = e.target.value;
                            handleUpdateSection(section.id!, { items: newItems });
                          }}
                          className="bg-transparent text-white focus:outline-none font-medium flex-1 px-2 py-1 hover:bg-white/5 rounded"
                        />
                        <button 
                          onClick={() => {
                            const newItems = section.items.filter(i => i.id !== item.id);
                            handleUpdateSection(section.id!, { items: newItems });
                          }}
                          className="text-gray-600 hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 px-2">
                        <input 
                          type="text" placeholder="Date (e.g. Aug 2025)" value={item.date || ''}
                          onChange={(e) => {
                            const newItems = [...section.items];
                            newItems[idx].date = e.target.value;
                            handleUpdateSection(section.id!, { items: newItems });
                          }}
                          className="bg-[#141416] text-sm text-gray-300 px-3 py-2 rounded-lg focus:outline-none border border-transparent focus:border-indigo-500/50"
                        />
                        <input 
                          type="text" placeholder="Link URL" value={item.link || ''}
                          onChange={(e) => {
                            const newItems = [...section.items];
                            newItems[idx].link = e.target.value;
                            handleUpdateSection(section.id!, { items: newItems });
                          }}
                          className="bg-[#141416] text-sm text-gray-300 px-3 py-2 rounded-lg focus:outline-none border border-transparent focus:border-indigo-500/50"
                        />
                      </div>
                      <div className="px-2">
                        <input 
                          type="text" placeholder="Image URL (optional)" value={item.imageUrl || ''}
                          onChange={(e) => {
                            const newItems = [...section.items];
                            newItems[idx].imageUrl = e.target.value;
                            handleUpdateSection(section.id!, { items: newItems });
                          }}
                          className="w-full bg-[#141416] text-sm text-gray-300 px-3 py-2 rounded-lg focus:outline-none border border-transparent focus:border-indigo-500/50"
                        />
                      </div>
                      <div className="px-2">
                        <textarea 
                          placeholder="Description..." value={item.description || ''}
                          onChange={(e) => {
                            const newItems = [...section.items];
                            newItems[idx].description = e.target.value;
                            handleUpdateSection(section.id!, { items: newItems });
                          }}
                          className="w-full bg-[#141416] text-sm text-gray-300 px-3 py-2 rounded-lg focus:outline-none border border-transparent focus:border-indigo-500/50 resize-none h-20"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Visitors Log */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-white/5 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Visitors Log</h2>
              <p className="text-sm text-gray-500">Recent visitors to your portfolio</p>
            </div>
            <div className="text-sm text-gray-400">Total Unique: {visitors.length}</div>
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {visitors.length === 0 ? (
              <p className="text-sm text-gray-600 italic">No visitors recorded yet.</p>
            ) : (
              <div className="grid gap-3">
                {visitors.map(visitor => (
                  <div key={visitor.id} className="flex justify-between items-center p-3 rounded-xl border bg-[#0d0d0f] border-white/5">
                    <div className="flex flex-col">
                      <span className="font-mono text-sm text-white">{visitor.ip}</span>
                      <span className="text-xs text-gray-400">{visitor.location || 'Unknown Location'}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {visitor.lastVisited ? new Date(visitor.lastVisited).toLocaleString() : 'Unknown Time'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Messages / Contact Form Submissions */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-white/5 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Messages</h2>
              <p className="text-sm text-gray-500">Contact form submissions from your portfolio</p>
            </div>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {messages.length === 0 ? (
              <p className="text-sm text-gray-600 italic">No messages yet.</p>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`p-4 rounded-xl border ${msg.read ? 'bg-[#0d0d0f] border-white/5' : 'bg-indigo-500/5 border-indigo-500/20'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-white">{msg.name}</h4>
                      <a href={`mailto:${msg.email}`} className="text-sm text-indigo-400 hover:underline">{msg.email}</a>
                    </div>
                    <span className="text-xs text-gray-500">
                      {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString() : new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{msg.message}</p>
                  {!msg.read && (
                    <button 
                      onClick={() => updateDoc(doc(db, "messages", msg.id), { read: true })}
                      className="mt-3 text-xs text-gray-400 hover:text-white"
                    >
                      Mark as Read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Security & Access Control */}
        <div className="bg-[#141416] p-6 rounded-2xl border border-white/5 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Security & Access</h2>
              <p className="text-sm text-gray-500">Manage blocked IP addresses and rate limits</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <form onSubmit={handleBlockIp} className="flex gap-4">
              <input 
                type="text" 
                placeholder="Enter IP Address to block (e.g. 192.168.1.1)" 
                value={newBlockedIp}
                onChange={(e) => setNewBlockedIp(e.target.value)}
                className="flex-1 bg-[#0d0d0f] text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-red-500/50"
              />
              <button 
                type="submit"
                disabled={!newBlockedIp.trim()}
                className="bg-red-500/10 text-red-400 border border-red-500/20 px-6 py-2 rounded-lg font-medium hover:bg-red-500/20 disabled:opacity-50 transition-colors"
              >
                Block IP
              </button>
            </form>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-400">Currently Blocked IPs</h3>
              {blockedIps.length === 0 ? (
                <p className="text-sm text-gray-600 italic">No IP addresses are currently blocked.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {blockedIps.map(({ ip }) => (
                    <div key={ip} className="flex items-center justify-between bg-[#0d0d0f] border border-white/5 p-3 rounded-lg">
                      <span className="text-sm text-gray-300 font-mono">{ip}</span>
                      <button 
                        onClick={() => handleUnblockIp(ip)}
                        className="text-xs text-gray-500 hover:text-green-400 font-medium"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
