import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, doc, getDoc, addDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { Section, Profile } from "../types";
import { MapPin, GraduationCap, Gamepad2, BookOpen, Shield, Code2, Link as LinkIcon, ShieldAlert, ArrowUpRight, Copy, Globe, Github, Twitter, Linkedin, Layers, Terminal as TerminalIcon, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "motion/react";
import { Chatbot } from "../components/Chatbot";
import { CustomCursor } from "../components/CustomCursor";
import { Terminal } from "../components/Terminal";
import { TiltCard } from "../components/TiltCard";
import { MagneticButton } from "../components/MagneticButton";
import { ScrambleText } from "../components/ScrambleText";
import { SystemHUD } from "../components/SystemHUD";
import { DraggableWindow } from "../components/DraggableWindow";
import { FirmwareLock } from "../components/FirmwareLock";

import { MatrixRain } from "../components/MatrixRain";

function useKonamiCode(callback: () => void) {
  useEffect(() => {
    let input: string[] = [];
    const konamiCode = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
    const handleKeyDown = (e: KeyboardEvent) => {
      input.push(e.key);
      input = input.slice(-10);
      if (input.join(",") === konamiCode.join(",")) {
        callback();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [callback]);
}

export default function Portfolio() {
  const [sections, setSections] = useState<Section[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [visitorInfo, setVisitorInfo] = useState<{ ip: string; location: string } | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [hackerMode, setHackerMode] = useState(false);
  const [activeWindows, setActiveWindows] = useState<any[]>([]);
  const [showFirmwareLock, setShowFirmwareLock] = useState(false);
  const [intrusionDetected, setIntrusionDetected] = useState(false);
  const { scrollYProgress } = useScroll();

  useKonamiCode(() => {
    setHackerMode(prev => !prev);
  });

  useEffect(() => {
    // Collect visitor info logic below
  }, []);

  // Reactive cinematic background values (Restoring the old magical gradient feel)
  const bgY1 = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const bgY2 = useTransform(scrollYProgress, [0, 1], ["0%", "-50%"]);
  const bgY3 = useTransform(scrollYProgress, [0, 1], ["-20%", "20%"]);
  
  const bgScale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.2, 1]);
  const rotate1 = useTransform(scrollYProgress, [0, 1], [0, 180]);
  const rotate2 = useTransform(scrollYProgress, [0, 1], [0, -180]);
  
  const color1 = useTransform(scrollYProgress, [0, 0.5, 1], ["rgba(79, 70, 229, 0.15)", "rgba(168, 85, 247, 0.15)", "rgba(59, 130, 246, 0.15)"]);
  const color2 = useTransform(scrollYProgress, [0, 0.5, 1], ["rgba(236, 72, 153, 0.1)", "rgba(99, 102, 241, 0.1)", "rgba(16, 185, 129, 0.1)"]);
  const color3 = useTransform(scrollYProgress, [0, 0.5, 1], ["rgba(59, 130, 246, 0.1)", "rgba(236, 72, 153, 0.1)", "rgba(139, 92, 246, 0.1)"]);

  useEffect(() => {
    // Check visitor IP
    const checkVisitor = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) throw new Error("ipapi failed");
        const data = await res.json();
        const ip = data.ip;
        
        if (ip && ip !== 'Unknown IP') {
          const cleanIp = ip.replace(/\//g, '-');
          const blockedDoc = await getDoc(doc(db, "blocked_ips", cleanIp));
          if (blockedDoc.exists()) {
            setIsBlocked(true);
            return;
          }
          
          let finalLocation = "Unknown Location";
          if (data.city) {
            finalLocation = `${data.city}, ${data.country_name}`;
          }
          setVisitorInfo({ ip, location: finalLocation });
          
          // Log visitor to db
          try {
            const { setDoc, serverTimestamp } = await import('firebase/firestore');
            await setDoc(doc(db, "visitors", cleanIp), {
              ip: ip,
              location: finalLocation,
              lastVisited: new Date().toISOString(),
              timestamp: serverTimestamp()
            }, { merge: true });
          } catch (dbErr) {
            console.warn('Visitor log warning:', dbErr);
          }
        }
      } catch (err) {
        // Fallback if ipapi is blocked
        try {
          const res = await fetch("https://api.ipify.org?format=json");
          const { ip } = await res.json();
          if (ip) {
            const cleanIp = ip.replace(/\//g, '-');
            setVisitorInfo({ ip, location: "Unknown Location" });
            const { setDoc, serverTimestamp } = await import('firebase/firestore');
            await setDoc(doc(db, "visitors", cleanIp), {
              ip: ip,
              location: "Unknown Location",
              lastVisited: new Date().toISOString(),
              timestamp: serverTimestamp()
            }, { merge: true });
          }
        } catch (e) {
          // Silently fail if all visitor info cannot be fetched
        }
      }
    };
    checkVisitor();
  }, []);

  useEffect(() => {
    if (isBlocked) return;
    
    // Fetch sections
    const q = query(collection(db, "sections"), where("visible", "==", true));
    const unsubscribeSections = onSnapshot(
      q,
      (snapshot) => {
        let data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Section[];
        data.sort((a, b) => a.order - b.order);
        setSections(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "sections")
    );

    // Fetch profile
    const unsubscribeProfile = onSnapshot(doc(db, "profiles", "main"), (docSnap) => {
      if (docSnap.exists()) {
        setProfile({ id: docSnap.id, ...docSnap.data() } as Profile);
      }
    });

    return () => {
      unsubscribeSections();
      unsubscribeProfile();
    }
  }, [isBlocked]);

  if (isBlocked) {
    return (
      <div className="min-h-screen bg-[#050507] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-3xl font-bold">Access Denied</h1>
        <p className="text-gray-400 max-w-md">Your IP address has been blocked from accessing this portfolio due to suspicious activity or abuse.</p>
      </div>
    );
  }

  const handleIntrusion = (e: React.MouseEvent) => {
    e.preventDefault();
    setIntrusionDetected(true);
    setTimeout(() => {
      setIntrusionDetected(false);
    }, 4000);
  };

  const getSocialLink = (platform: string, value: string) => {
    if (!value) return "#";
    if (value.startsWith('http')) return value;
    switch(platform) {
      case 'github': return `https://github.com/${value.replace('@', '')}`;
      case 'linkedin': return `https://linkedin.com${value}`;
      case 'twitter': return `https://twitter.com/${value.replace('@', '')}`;
      default: return "#";
    }
  };

  const defaultSkills = ["React.js", "Node.js", "TypeScript", "Python", "C/C++", "Java", "Tailwind CSS", "MongoDB", "Firebase"];
  const skillsArray = profile?.skills || defaultSkills;
  const loopSkills = [...skillsArray, ...skillsArray, ...skillsArray, ...skillsArray];

  // Dynamic Typography Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };
  const wordVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 150, damping: 20 } }
  };

  return (
    <AnimatePresence>
      <div className={`portfolio-container min-h-screen ${hackerMode ? 'bg-black text-green-500 font-mono' : 'bg-[#050507] text-gray-200 font-sans'} selection:bg-indigo-500/30 relative overflow-hidden transition-colors duration-1000`}>
        
        {showFirmwareLock && <FirmwareLock onClose={() => setShowFirmwareLock(false)} />}
        
        {intrusionDetected && (
          <div className="fixed inset-0 z-[99999] bg-red-900 flex flex-col items-center justify-center font-mono mix-blend-difference animate-pulse">
            <h1 className="text-6xl md:text-8xl font-bold text-white tracking-tighter mb-4 text-center px-4">INTRUSION DETECTED</h1>
            <p className="text-2xl md:text-4xl text-white/80">IP {visitorInfo?.ip || 'UNKNOWN'} LOGGED.</p>
            <div className="mt-8 text-white/50 text-sm">Initiating trace...</div>
          </div>
        )}

        {hackerMode && (
          <>
            <MatrixRain />
            <div className="fixed inset-0 pointer-events-none z-[9998] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/10 to-transparent animate-[scan_2s_linear_infinite]" />
            </div>
          </>
        )}

        {/* System HUD Overlay */}
        <SystemHUD />

        {/* Custom Cursor Component */}
        <CustomCursor />

        {/* Reactive Background Gradients */}
        {!hackerMode && (
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center">
            <motion.div 
              style={{ y: bgY1, scale: bgScale, rotate: rotate1, backgroundColor: color1 }}
              className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] rounded-full blur-[120px]" 
            />
            <motion.div 
              style={{ y: bgY2, scale: bgScale, rotate: rotate2, backgroundColor: color2 }}
              className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] max-w-[700px] max-h-[700px] rounded-full blur-[120px]" 
            />
            <motion.div 
              style={{ y: bgY3, scale: bgScale, backgroundColor: color3 }}
              className="absolute top-[30%] left-[30%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full blur-[150px]" 
            />
          </div>
        )}

        <div className="relative z-10 max-w-[1000px] mx-auto px-6 py-12 sm:py-20 space-y-24">
          
          {/* Header / Profile with Dynamic Typography */}
          <motion.header 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-8 pt-12 text-center sm:text-left"
          >
            <div className="flex justify-center sm:justify-start gap-3">
              <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-gray-300 backdrop-blur-sm hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-shadow duration-300 cursor-default">Available for hire</span>
              <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-gray-300 backdrop-blur-sm hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-shadow duration-300 cursor-default">Based in India</span>
            </div>

            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-white pb-2 flex flex-wrap justify-center sm:justify-start gap-[0.3em]">
                {`Hello, I'm ${profile?.name ? profile.name.split(" ")[0] : "Dikhyant"}.`.split(" ").map((word, i) => (
                  <motion.span key={i} variants={wordVariants} className="inline-block">{word}</motion.span>
                ))}
              </h1>
              <motion.p variants={wordVariants} className={`text-xl sm:text-2xl ${hackerMode ? 'text-green-400' : 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400'} font-medium tracking-wide`}>
                {profile?.subtitle || "Full Stack Developer."}
              </motion.p>
            </motion.div>
            
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4 text-sm sm:text-base text-gray-400">
              <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 shadow-sm"><MapPin className="w-4 h-4 text-indigo-400" /> {profile?.location || "Odisha, India"}</span>
              <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 shadow-sm"><GraduationCap className="w-4 h-4 text-indigo-400" /> {profile?.educationInfo || "Class of 2028"}</span>
              <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 shadow-sm"><Code2 className="w-4 h-4 text-indigo-400" /> {profile?.institution || "ITER, SOA University"}</span>
            </div>

            <div className="text-gray-400 text-lg max-w-2xl mx-auto sm:mx-0 whitespace-pre-wrap">
              <p>
                {profile?.bio || "I build accessible, pixel-perfect, and scalable web apps. Specializing in modern UI/UX architecture and cybersecurity to turn complex problems into elegant digital reality."}
              </p>
            </div>

            <div className="flex flex-wrap justify-center sm:justify-start gap-4 pt-4">
              <MagneticButton 
                onClick={(e) => {
                  e.preventDefault();
                  const email = profile?.email || 'dikhyantsatpathy@gmail.com';
                  // Browsers block popups if delayed (setTimeout). We must open it synchronously.
                  // We open Gmail web in a new tab, and also attempt to trigger the local mail app.
                  window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}`, '_blank');
                  window.location.href = `mailto:${email}`;
                }} 
                className="bg-white text-black px-6 py-3 rounded-full font-medium hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm cursor-pointer"
              >
                Connect now <ArrowUpRight className="w-4 h-4" />
              </MagneticButton>
              <MagneticButton onClick={() => navigator.clipboard.writeText(profile?.email || 'dikhyantsatpathy@gmail.com')} className="bg-[#111] text-white border border-white/10 px-6 py-3 rounded-full font-medium hover:bg-white/5 transition-colors flex items-center gap-2 text-sm">
                <Copy className="w-4 h-4 text-gray-400" /> Copy Email
              </MagneticButton>
            </div>
          </motion.header>

          {/* Interactive Terminal */}
          <motion.section 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            className="pt-12"
          >
            <div className="flex items-center gap-3 justify-center sm:justify-start">
              <TerminalIcon className="w-6 h-6 text-indigo-400" />
              <h2 className="text-2xl font-bold text-white tracking-tight">
                <ScrambleText text="Interactive Terminal" />
              </h2>
            </div>
            <Terminal profile={profile} />
          </motion.section>

          {/* Interests Section */}
          {(profile?.interests && profile.interests.length > 0) && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.8 }}
              className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(profile.interests.length, 3)} gap-6`}
            >
              {profile.interests.map((interest, idx) => {
                const colors = [
                  { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20", hover: "hover:border-indigo-500/50", gradient: "from-indigo-500/10" },
                  { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", hover: "hover:border-purple-500/50", gradient: "from-purple-500/10" },
                  { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", hover: "hover:border-blue-500/50", gradient: "from-blue-500/10" },
                  { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", hover: "hover:border-emerald-500/50", gradient: "from-emerald-500/10" },
                  { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", hover: "hover:border-amber-500/50", gradient: "from-amber-500/10" },
                ];
                const c = colors[idx % colors.length];
                
                const getIcon = (iconName: string) => {
                  switch (iconName.toLowerCase()) {
                    case 'gamepad': return <Gamepad2 className="w-7 h-7" />;
                    case 'shield': return <Shield className="w-7 h-7" />;
                    case 'book': return <BookOpen className="w-7 h-7" />;
                    case 'code': return <Code2 className="w-7 h-7" />;
                    default: return <Sparkles className="w-7 h-7" />;
                  }
                };

                return (
                  <div key={interest.id} className={`group relative bg-white/[0.02] backdrop-blur-md p-8 rounded-[1.5rem] border border-white/5 ${c.hover} hover:bg-white/[0.04] transition-all duration-500 overflow-hidden shadow-2xl`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                    <div className="relative z-10 space-y-5">
                      <div className={`p-4 ${c.bg} w-fit rounded-2xl ${c.text} group-hover:scale-110 transition-transform duration-500 border ${c.border} shadow-inner`}>
                        {getIcon(interest.icon)}
                      </div>
                      <h3 className="text-xl font-semibold text-white">{interest.title}</h3>
                      <p className="text-gray-400 leading-relaxed">
                        {interest.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </motion.section>
          )}

          {/* The Secret Sauce (Skills/Tech Stack) Marquee Fixed Perfect Loop */}
          <motion.section 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-8 overflow-hidden"
          >
            <div className="flex items-center gap-3 justify-center sm:justify-start">
              <TerminalIcon className="w-6 h-6 text-white" />
              <h2 className="text-2xl font-bold text-white tracking-tight">
                <ScrambleText text="The Secret Sauce" />
              </h2>
            </div>
            <div className="relative w-full flex flex-col gap-4 overflow-hidden mask-edges pb-4">
              {/* Top Row - Marquee Left to Right Perfect Loop */}
              <motion.div 
                animate={{ x: ["-50%", "0%"] }}
                transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
                className="flex whitespace-nowrap gap-3 w-max"
              >
                {loopSkills.map((skill, idx) => (
                  <span key={`${skill}-${idx}-top`} className="px-5 py-3 bg-white/[0.02] border border-white/5 rounded-[1rem] text-gray-300 text-sm cursor-default hover:bg-white/5 transition-colors hover:text-white hover:border-indigo-500/30">
                    {skill}
                  </span>
                ))}
              </motion.div>
              
              {/* Bottom Row - Marquee Right to Left Perfect Loop */}
              <motion.div 
                animate={{ x: ["0%", "-50%"] }}
                transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
                className="flex whitespace-nowrap gap-3 w-max"
              >
                {loopSkills.map((skill, idx) => (
                  <span key={`${skill}-${idx}-bottom`} className="px-5 py-3 bg-white/[0.02] border border-white/5 rounded-[1rem] text-gray-300 text-sm cursor-default hover:bg-white/5 transition-colors hover:text-white hover:border-purple-500/30">
                    {skill}
                  </span>
                ))}
              </motion.div>
            </div>
          </motion.section>

          {/* Dynamic Sections (Selected Work with 3D Tilt Cards and OS Windows) */}
          <div className="space-y-32 relative z-50">
            {/* Active OS Windows */}
            <AnimatePresence>
              {activeWindows.map((win, i) => (
                <DraggableWindow 
                  key={`${win.id}-${i}`} 
                  title={win.title} 
                  onClose={() => setActiveWindows(prev => prev.filter((_, idx) => idx !== i))}
                >
                  <div className="p-6 space-y-4">
                    {win.imageUrl && (
                      <img src={win.imageUrl} alt={win.title} className="w-full h-auto rounded-lg shadow-lg border border-white/10" />
                    )}
                    <p className="text-gray-300 leading-relaxed text-sm md:text-base">{win.description}</p>
                    {win.link && (
                      <a href={win.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300">
                        View Project <ArrowUpRight className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </DraggableWindow>
              ))}
            </AnimatePresence>

            {sections.map((section, idx) => (
              section.items.length > 0 && (
                <motion.section 
                  key={section.id}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.7, delay: idx * 0.1 }}
                  className="space-y-12"
                >
                  <div className="flex items-center gap-6">
                    <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                      <ScrambleText text={section.title} />
                    </h2>
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-indigo-500/30 via-white/10 to-transparent" />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 perspective-1000">
                    {section.items.map((item) => (
                      <div key={item.id} onClick={() => setActiveWindows(prev => [...prev, item])} className="cursor-pointer group">
                        <TiltCard>
                          <div className="h-full flex flex-col bg-[#0a0a0c]/80 backdrop-blur-xl rounded-[2rem] border border-white/5 overflow-hidden transition-all duration-700 group-hover:border-indigo-500/50 group-hover:bg-white/[0.03] shadow-[0_10px_30px_-15px_rgba(0,0,0,0.5)]">
                            {item.imageUrl && (
                              <div className="h-64 w-full bg-[#050507] overflow-hidden relative border-b border-white/5">
                                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
                                {/* Hover Video Preview overlay mock */}
                                <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-overlay" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-transparent pointer-events-none" />
                              </div>
                            )}
                            <div className="p-8 flex flex-col flex-1 relative z-10">
                              <div className="flex justify-between items-start gap-4">
                                <h3 className="text-2xl font-bold text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-indigo-400 group-hover:to-purple-400 transition-all duration-500">{item.title}</h3>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-4">
                                {item.date && (
                                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-gray-400 text-xs font-medium">
                                    {item.date}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="mt-5 text-gray-400 leading-relaxed flex-1 text-base line-clamp-3">{item.description}</p>
                              )}
                              <p className="text-xs text-indigo-400/50 mt-6 font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-300">{'>> CLICK TO OPEN IN WINDOW'}</p>
                            </div>
                          </div>
                        </TiltCard>
                      </div>
                    ))}
                  </div>
                </motion.section>
              )
            ))}
          </div>

          {/* Let's Work Together CTA */}
          <motion.section 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-32 p-12 sm:p-24 bg-[#0a0a0c] border border-white/5 rounded-[3rem] text-center space-y-8 relative overflow-hidden shadow-2xl"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-[100px] pointer-events-none" />
            
            <div className="relative z-10 space-y-6">
              <h2 className="text-5xl sm:text-7xl font-bold text-white tracking-tight">Let's work together.</h2>
              <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto">
                Have a project in mind? Let's build something amazing together.
              </p>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                if (formData.get('honeypot')) {
                  return;
                }
                const btn = (e.target as HTMLFormElement).querySelector('button');
                const name = formData.get('name') as string;
                const email = formData.get('email') as string;
                const message = formData.get('message') as string;
                
                if (btn) {
                  const originalText = btn.innerText;
                  btn.innerText = 'Sending...';
                  try {
                    const { serverTimestamp } = await import('firebase/firestore');
                    await addDoc(collection(db, "messages"), {
                      name,
                      email,
                      message,
                      createdAt: serverTimestamp(),
                      read: false
                    });
                    
                    btn.innerText = 'Message Sent!';
                    (e.target as HTMLFormElement).reset();
                  } catch (error: any) {
                    console.error("Error sending message", error);
                    btn.innerText = 'Error! Try again.';
                  } finally {
                    setTimeout(() => btn.innerText = originalText, 3000);
                  }
                }
              }} className="mt-12 max-w-md mx-auto space-y-4 text-left">
                {/* Honeypot field (hidden from real users, attractive to bots) */}
                <input type="text" name="honeypot" className="hidden" tabIndex={-1} autoComplete="off" />
                
                <input type="text" name="name" placeholder="Name" required className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-500" />
                <input type="email" name="email" placeholder="Email" required className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-500" />
                <textarea name="message" placeholder="Message" required rows={4} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white outline-none focus:border-indigo-500 transition-colors resize-none placeholder:text-gray-500" />
                
                <button type="submit" className="w-full bg-indigo-600 text-white px-8 py-4 rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-[0_0_30px_-5px_rgba(79,70,229,0.5)] active:scale-95">
                  Send Message
                </button>
              </form>

              <div className="flex flex-wrap justify-center gap-4 pt-8 border-t border-white/10 mt-8">
                <MagneticButton 
                  href="mailto:dikhyantsatpathy@gmail.com" target="_top"
                  className="bg-white/5 text-gray-300 border border-white/10 px-8 py-4 rounded-full font-medium hover:bg-white/10 transition-colors"
                >
                  Or just email me directly
                </MagneticButton>
              </div>
            </div>
          </motion.section>

          {/* Footer */}
          <footer className="pt-24 pb-8 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-gray-500">
            <p>© {new Date().getFullYear()} {profile?.name || "Dikhyant Satapathy"}. All rights reserved.</p>
            <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6">
              {visitorInfo && (
                <div className="flex items-center gap-2 mr-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Your IP: {visitorInfo.ip} • {visitorInfo.location}</span>
                </div>
              )}
              <a href={getSocialLink('twitter', profile?.twitter || '')} target="_blank" rel="noreferrer" className="magnetic hover:text-white transition-colors p-2">Twitter</a>
              <a href={getSocialLink('linkedin', profile?.linkedin || '')} target="_blank" rel="noreferrer" className="magnetic hover:text-white transition-colors p-2">LinkedIn</a>
              <a href={getSocialLink('github', profile?.github || '')} target="_blank" rel="noreferrer" className="magnetic hover:text-white transition-colors p-2">GitHub</a>
              <Link to="/admin" className="hover:text-white transition-colors ml-2 pl-6 border-l border-white/10">Admin Panel</Link>
              <a href="#" onClick={handleIntrusion} className="text-xs text-red-900/50 hover:text-red-500 transition-colors cursor-pointer">Restricted Area</a>
            </div>
          </footer>
        </div>
        <Chatbot />
      </div>
    </AnimatePresence>
  );
}
