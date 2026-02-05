import type { SynthEngine } from './SynthEngine'
import {
  EngineIdleVoice,
  EngineLowVoice,
  EngineMidVoice,
  EngineHighVoice,
  EngineDecelVoice,
} from './voices/EngineVoices'
import {
  TireScreechVoice,
  GrassRollVoice,
  CurbRattleVoice,
} from './voices/TireVoices'
import {
  WindVoice,
  RainVoice,
  AquaplaningVoice,
} from './voices/AmbientVoices'
import {
  ErsDeployVoice,
  ErsHarvestVoice,
  ErsOvertakeVoice,
  ErsBatteryCriticalVoice,
} from './voices/ErsVoices'
import {
  OverheatAlarmVoice,
  TrackViolationVoice,
} from './voices/AlarmVoices'
import {
  EngineShiftVoice,
  DriftVoice,
  CollisionVoice,
  AeroToggleVoice,
  UIClickVoice,
  UILapCompleteVoice,
  UIBestLapVoice,
  UIGearShiftVoice,
  UIPitCompleteVoice,
  UIModeToggleVoice,
  CountdownBeepVoice,
  CountdownGoVoice,
  GamePauseVoice,
  GameResumeVoice,
  RaceFinishVoice,
} from './voices/OneShotVoices'

export { SynthEngine } from './SynthEngine'
export type { SynthVoice } from './SynthVoice'

export function registerAllVoices(engine: SynthEngine): void {
  engine.registerVoice('engine-idle', 'engine', ctx => new EngineIdleVoice(ctx))
  engine.registerVoice('engine-low', 'engine', ctx => new EngineLowVoice(ctx))
  engine.registerVoice('engine-mid', 'engine', ctx => new EngineMidVoice(ctx))
  engine.registerVoice('engine-high', 'engine', ctx => new EngineHighVoice(ctx))
  engine.registerVoice('engine-decel', 'engine', ctx => new EngineDecelVoice(ctx))

  engine.registerVoice('tire-screech', 'effects', ctx => new TireScreechVoice(ctx))
  engine.registerVoice('grass-roll', 'effects', ctx => new GrassRollVoice(ctx))
  engine.registerVoice('curb-rattle', 'effects', ctx => new CurbRattleVoice(ctx))

  engine.registerVoice('wind', 'effects', ctx => new WindVoice(ctx))
  engine.registerVoice('rain', 'effects', ctx => new RainVoice(ctx))
  engine.registerVoice('aquaplaning', 'effects', ctx => new AquaplaningVoice(ctx))

  engine.registerVoice('ers-deploy', 'effects', ctx => new ErsDeployVoice(ctx))
  engine.registerVoice('ers-harvest', 'effects', ctx => new ErsHarvestVoice(ctx))
  engine.registerVoice('ers-overtake', 'effects', ctx => new ErsOvertakeVoice(ctx))
  engine.registerVoice('ers-battery-critical', 'effects', ctx => new ErsBatteryCriticalVoice(ctx))

  engine.registerVoice('overheat-alarm', 'effects', ctx => new OverheatAlarmVoice(ctx))
  engine.registerVoice('track-violation', 'effects', ctx => new TrackViolationVoice(ctx))

  engine.registerVoice('engine-shift', 'engine', ctx => new EngineShiftVoice(ctx))
  engine.registerVoice('drift', 'effects', ctx => new DriftVoice(ctx))
  engine.registerVoice('collision', 'effects', ctx => new CollisionVoice(ctx))
  engine.registerVoice('aero-toggle', 'effects', ctx => new AeroToggleVoice(ctx))

  engine.registerVoice('ui-click', 'ui', ctx => new UIClickVoice(ctx))
  engine.registerVoice('ui-lap-complete', 'ui', ctx => new UILapCompleteVoice(ctx))
  engine.registerVoice('ui-best-lap', 'ui', ctx => new UIBestLapVoice(ctx))
  engine.registerVoice('ui-gear-shift', 'ui', ctx => new UIGearShiftVoice(ctx))
  engine.registerVoice('ui-pit-complete', 'ui', ctx => new UIPitCompleteVoice(ctx))
  engine.registerVoice('ui-mode-toggle', 'ui', ctx => new UIModeToggleVoice(ctx))

  engine.registerVoice('countdown-beep', 'ui', ctx => new CountdownBeepVoice(ctx))
  engine.registerVoice('countdown-go', 'ui', ctx => new CountdownGoVoice(ctx))
  engine.registerVoice('game-pause', 'ui', ctx => new GamePauseVoice(ctx))
  engine.registerVoice('game-resume', 'ui', ctx => new GameResumeVoice(ctx))
  engine.registerVoice('race-finish', 'ui', ctx => new RaceFinishVoice(ctx))
}
