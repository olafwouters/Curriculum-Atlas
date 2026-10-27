from pathlib import Path
import subprocess,sys,os,socket,time,webbrowser
ROOT=Path(__file__).resolve().parent
port=8022
sock=socket.socket();sock.settimeout(1)
try:
 occupied=sock.connect_ex(('127.0.0.1',port))==0
finally:sock.close()
if occupied:
 print('Port 8022 is already in use. Stop the OLD server with Control+C, then run this launcher again. No processes were killed.')
 raise SystemExit(1)
venv=ROOT/'.venv';python=venv/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
if not python.exists():subprocess.check_call([sys.executable,'-m','venv',str(venv)])
check=subprocess.run([str(python),'-c','import flask, requests, bs4'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
if check.returncode:subprocess.check_call([str(python),'-m','pip','install','-r',str(ROOT/'requirements.txt')])
proc=subprocess.Popen([str(python),str(ROOT/'server.py')],cwd=ROOT)
try:
 for _ in range(80):
  if proc.poll() is not None:raise SystemExit('Server did not start. Read the error above.')
  import urllib.request
  try:
   with urllib.request.urlopen('http://127.0.0.1:8022/api/framework',timeout=.5) as r:
    if r.status==200:break
  except Exception:time.sleep(.25)
 else:raise SystemExit('Server startup timed out.')
 print('\nOpen http://127.0.0.1:8022 — keep this window open. Control+C stops the server.\n')
 webbrowser.open('http://127.0.0.1:8022');proc.wait()
except KeyboardInterrupt:pass
finally:
 if proc.poll() is None:
  proc.terminate()
  try:proc.wait(timeout=5)
  except subprocess.TimeoutExpired:proc.kill()
