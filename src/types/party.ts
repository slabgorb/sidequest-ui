export interface CharacterSummary {
  player_id: string;
  name: string;
  character_name: string;
  portrait_url?: string;
  hp: number;
  hp_max: number;
  status_effects: string[];
  class: string;
  level: number;
  current_location: string;
}
