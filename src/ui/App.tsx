import { useEffect, useState } from 'react';

export function App() {
  const [pingResult, setPingResult] = useState('…');
  const [appVersion, setAppVersion] = useState('…');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const runIpcTest = async () => {
      try {
        const [pong, version] = await Promise.all([
          window.netxscan.ping(),
          window.netxscan.getAppVersion(),
        ]);

        if (!cancelled) {
          setPingResult(pong);
          setAppVersion(version);
        }
      } catch {
        if (!cancelled) {
          setErrorMessage('IPC test failed.');
        }
      }
    };

    void runIpcTest();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-8">
        <p className="text-sm font-medium uppercase tracking-widest text-sky-400">
          Module 2
        </p>
        <h1 className="text-4xl font-semibold">NetXScan</h1>
        <p className="text-slate-300">
          Secure IPC test only. The renderer calls named preload methods. It
          cannot run shell commands or other privileged work.
        </p>
        <dl className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">ping</dt>
            <dd className="font-mono text-sky-300">{pingResult}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">app version</dt>
            <dd className="font-mono text-sky-300">{appVersion}</dd>
          </div>
        </dl>
        {errorMessage ? (
          <p className="text-sm text-red-400">{errorMessage}</p>
        ) : null}
      </div>
    </main>
  );
}
