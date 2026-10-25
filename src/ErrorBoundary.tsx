import { Component, type ErrorInfo, type ReactNode } from 'react';
export default class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(_error:Error,_info:ErrorInfo){/* Intentionally omit private UI data and tokens from logs. */}
  render(){return this.state.failed?<main className="crash-page"><span className="eyebrow">YAPSPACE</span><h1>Let’s get you back.</h1><p>The interface ran into a problem. Reload to reconnect and retrieve your saved conversations.</p><button className="primary-button" onClick={()=>window.location.reload()}>Reload YapSpace</button><small>Unconfirmed messages may need checking before you send them again.</small></main>:this.props.children;}
}
