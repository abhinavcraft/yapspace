import { useState, type FormEvent } from 'react';
import { ArrowRight, Leaf, LoaderCircle, MessageCircle, Moon, Sparkles, Sun } from 'lucide-react';
import { demoEnabled, supabase } from './data';
import { RecoveryRequest } from './PasswordRecovery';
import { emailRedirectUrl } from './auth-redirect';
import type { Theme } from './PersonalSpace';
import GoogleButton from './GoogleButton';
export default function Auth({onDemo,theme,onTheme,initialSignup=false}:{onDemo:()=>void;theme:Theme;onTheme:()=>void;initialSignup?:boolean}){
  const [signup,setSignup]=useState(initialSignup),[recover,setRecover]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [googleBusy,setGoogleBusy]=useState(false);
  async function googleSignIn(){
    if(!supabase||busy)return;
    setBusy(true);setGoogleBusy(true);setError('');setNotice('');
    try{
      const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:emailRedirectUrl(),queryParams:{prompt:'select_account'}}});
      if(error)throw error;
    }catch{setError('Google sign-in couldn’t start. Please try again, or sign in with email.');}
    finally{setBusy(false);setGoogleBusy(false);}
  }
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!supabase){setError('YapSpace isn’t connected to its account service yet. Please contact the site owner.');return;}setBusy(true);setError('');setNotice('');const form=new FormData(e.currentTarget);const credentials={email:String(form.get('email')).trim(),password:String(form.get('password'))};
    try{const {error}=signup?await supabase.auth.signUp({...credentials,options:{emailRedirectTo:emailRedirectUrl()}}):await supabase.auth.signInWithPassword(credentials);if(error)throw error;if(signup)setNotice('Check your email to confirm your account, then sign in.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  if(recover)return <RecoveryRequest onBack={()=>setRecover(false)}/>;
  return <main className="auth-page"><div className="auth-story"><div className="auth-brand-row"><div className="brand">YapSpace<span className="brand-dot">.</span></div><button className="icon-button" aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'} onClick={onTheme}>{theme==='dark'?<Sun size={20}/>:<Moon size={20}/>}</button></div><div className="auth-story-content"><span className="eyebrow">LESS NOISE. MORE CONNECTION.</span><h1>Your people.<br/>Your space<span>.</span></h1><p>Big ideas, little updates, and everything in between. A little space for the conversations that matter.</p><div className="auth-art"><span className="art-leaf one"><Leaf/></span><span className="art-message">Hey, you. 👋</span><span className="art-message second">Make yourself at home. 🌿</span><span className="art-leaf two"><Sparkles/></span></div></div><span className="auth-caption">A GOOD CONVERSATION STARTS WITH HELLO.</span></div><div className="auth-form-area"><div className="auth-form"><span className="welcome-mark"><MessageCircle size={29}/></span><h2>{signup?'Find your little corner.':'Good to have you here.'}</h2><p>{signup?'A few details, and you’re one hello closer.':'Sign in and pick up where you left off.'}</p>{supabase&&<><GoogleButton busy={googleBusy} disabled={busy} onClick={()=>void googleSignIn()}/><div className="auth-divider oauth-divider"><span>or continue with email</span></div></>}<form onSubmit={submit}><label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required/></label><label>Password<input name="password" type="password" autoComplete={signup?'new-password':'current-password'} minLength={signup?12:1} maxLength={128} placeholder={signup?'At least 12 characters':'Your password'} required/></label>{!signup&&supabase&&<button type="button" className="forgot-password" onClick={()=>setRecover(true)}>Forgot password?</button>}{error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="form-notice" role="status">{notice}</p>}<button className="primary-button full" disabled={busy}>{busy?<LoaderCircle className="spin" size={18}/>:signup?'Create your account':'Sign in'}<ArrowRight size={18}/></button></form><p className="switch-auth">{signup?'Already have an account?':'New around here?'} <button disabled={busy} onClick={()=>{setSignup(!signup);setError('');setNotice('');}}>{signup?'Sign in':'Join YapSpace'}</button></p>{demoEnabled&&<><div className="auth-divider"><span>or get a feel for the place</span></div><button className="secondary-button full" onClick={onDemo}>Explore the demo <Leaf size={17}/></button></>}</div></div></main>;
}
