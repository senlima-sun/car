import { useEffect } from 'react'
import { useGameStore, type GameStatus } from '@/stores/useGameStore'

export function useSyncGameStatus(status: GameStatus): void {
  useEffect(() => {
    useGameStore.setState({ status })
  }, [status])
}
