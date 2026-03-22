import { useCallback, useRef, useState } from 'react';
import { HandCamera } from './components/HandCamera';
import { MainCanvas } from './components/MainCanvas';
import type { Technique } from './technique';
import './App.css';

function App() {
  const [technique, setTechnique] = useState<Technique>('idle');
  const [strength, setStrength] = useState(0);
  const handOffsetRef = useRef<{ x: number; y: number } | null>(null);

  const onTechnique = useCallback((t: Technique, s: number) => {
    setTechnique(t);
    setStrength(s);
  }, []);

  const onHandOffset = useCallback(
    (o: { x: number; y: number } | null) => {
      handOffsetRef.current = o;
    },
    [],
  );

  return (
    <div className="app-root">
      <MainCanvas
        technique={technique}
        strength={strength}
        handOffsetRef={handOffsetRef}
      />
      <header className="app-title">
        <img
          className="app-title__logo"
          src="/jjk-logo.png"
          width={560}
          height={160}
          alt="呪術廻戦"
          draggable={false}
        />
      </header>
      <HandCamera onTechnique={onTechnique} onHandOffset={onHandOffset} />
    </div>
  );
}

export default App;
