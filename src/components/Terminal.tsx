import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';

interface TerminalProps {
  profile: any;
  visitorInfo?: any;
}

export const Terminal = ({ profile, visitorInfo }: TerminalProps) => {
  const [history, setHistory] = useState<{ type: 'input' | 'output'; content: React.ReactNode }[]>([
    { type: 'output', content: 'Welcome to the interactive terminal.' },
    { type: 'output', content: 'Type "help" to see available commands.' },
  ]);
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [history]);

  const runNmap = () => {
    setIsScanning(true);
    const ip = visitorInfo?.ip || '192.168.1.104';
    const lines = [
      `Starting Nmap 7.93 ( https://nmap.org ) at ${new Date().toISOString()}`,
      `Nmap scan report for ${ip}`,
      `Host is up (0.013s latency).`,
      `Not shown: 996 closed tcp ports (conn-refused)`,
      `PORT     STATE SERVICE`,
      `22/tcp   open  ssh`,
      `80/tcp   open  http`,
      `443/tcp  open  https`,
      `3306/tcp open  mysql`,
      `Device type: general purpose`,
      `Running: Linux 4.X|5.X`,
      `OS CPE: cpe:/o:linux:linux_kernel:5.4`,
      `OS details: Linux 4.15 - 5.6`,
      `Network Distance: 2 hops`,
      ``,
      `OS detection performed. Please report any incorrect results at https://nmap.org/submit/ .`,
      `Nmap done: 1 IP address (1 host up) scanned in 2.34 seconds`,
      ` `,
      `> ACCESS GRANTED.`
    ];

    let currentLine = 0;
    const interval = setInterval(() => {
      if (currentLine < lines.length) {
        const line = lines[currentLine];
        setHistory(prev => [...prev, { type: 'output', content: <div className={line.includes('ACCESS GRANTED') ? 'text-green-500 font-bold' : ''}>{line}</div> }]);
        currentLine++;
      } else {
        clearInterval(interval);
        setIsScanning(false);
      }
    }, 150);
  };

  const handleCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim().toLowerCase();
    setHistory((prev) => [...prev, { type: 'input', content: cmd }]);

    let output: React.ReactNode = '';

    switch (trimmedCmd) {
      case 'help':
        output = (
          <div className="space-y-1">
            <p><span className="text-indigo-400">whoami</span> - Display profile information</p>
            <p><span className="text-indigo-400">skills</span> - List all tech skills</p>
            <p><span className="text-indigo-400">nmap</span>   - Run network diagnostics on current connection</p>
            <p><span className="text-indigo-400">clear</span>  - Clear the terminal</p>
            <p><span className="text-indigo-400">contact</span> - Show contact details</p>
          </div>
        );
        break;
      case 'whoami':
        output = (
          <div>
            <p>Name: {profile?.name || 'Dikhyant'}</p>
            <p>Role: {profile?.subtitle || 'Developer'}</p>
            <p>Location: {profile?.location || 'Earth'}</p>
          </div>
        );
        break;
      case 'skills':
        output = (
          <div className="flex flex-wrap gap-2">
            {(profile?.skills || ['React', 'TypeScript', 'Node']).map((s: string, i: number) => (
              <span key={i} className="text-emerald-400">[{s}]</span>
            ))}
          </div>
        );
        break;
      case 'nmap':
        runNmap();
        return;
      case 'contact':
        output = (
          <div>
            <p>Email: {profile?.email || 'dikhyantsatpathy@gmail.com'}</p>
            <p>GitHub: {profile?.github || '@dikhyant'}</p>
          </div>
        );
        break;
      case 'clear':
        setHistory([]);
        return;
      case '':
        return;
      default:
        output = <p className="text-red-400">Command not found: {cmd}. Type "help" for a list of commands.</p>;
    }

    setHistory((prev) => [...prev, { type: 'output', content: output }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isScanning) {
      handleCommand(input);
      setInput('');
    }
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`w-full max-w-2xl mx-auto bg-[#0a0a0c] rounded-xl border transition-all duration-300 overflow-hidden font-mono text-sm shadow-2xl cursor-text ${isFocused ? 'border-indigo-500/50 shadow-[0_0_30px_-5px_rgba(79,70,229,0.3)]' : 'border-white/10'}`}
      onClick={handleContainerClick}
    >
      <div className="flex items-center px-4 py-2 bg-white/5 border-b border-white/10 gap-2">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-2 text-gray-500 text-xs">guest@portfolio ~ /terminal</span>
      </div>
      <div ref={scrollContainerRef} className="p-4 h-64 overflow-y-auto space-y-2 text-gray-300 scroll-smooth">
        {history.map((line, i) => (
          <div key={i} className={line.type === 'input' ? 'flex text-indigo-400' : 'text-gray-300'}>
            {line.type === 'input' && <span className="mr-2">{'guest@portfolio:~$ '}</span>}
            <div>{line.content}</div>
          </div>
        ))}
        <div className="flex text-indigo-400">
          <span className="mr-2">{'guest@portfolio:~$ '}</span>
          <div className="relative flex-1 flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={isScanning}
              className="absolute inset-0 bg-transparent outline-none border-none text-transparent text-white disabled:opacity-50 z-10 w-full"
              autoFocus
              spellCheck={false}
              style={{ caretColor: 'transparent' }}
            />
            <span className="whitespace-pre text-white flex items-center">
              {input}
              <span className={`inline-block w-2.5 h-4 ml-[1px] ${isFocused ? 'bg-white/90 animate-pulse' : 'bg-white/50 animate-pulse'}`} />
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
