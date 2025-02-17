<template>
  <div class="p-6">
    <div class="grid justify-center">
      <span class="grid grid-cols-2">
        <div class="text text-base justify-self-start self-center text-yellow-200 w-64">
          {{ username }}
        </div>
      </span>
      <br />
      <div class="flex justify-between">
        <div class="avatar justify-start">
          <div class="w-24 rounded">
            <img :src="profilePicture" />
          </div>
        </div>
        <div>
          <div class="text">
            W/L ratio: <span class="text text-green-500">{{ wins }}</span
            >/<span class="text text-red-600">{{ losses }}</span>
          </div>
          <br />
          <button class="btn justify-self-end w-60" @click="inviteToGame">Invite to game</button>
        </div>
      </div>

      <div style="clear: both; padding-top: 50px">
        <div class="collapse w-auto bg-base-200">
          <input type="checkbox" />
          <div class="collapse-title text-xl text-center font-bold px-0">Match history</div>
          <div class="collapse-content">
            <MatchReport
              v-for="match in matchHistory"
              :key="match.id"
              :leftPlayerName="match.players[0].username"
              :rightPlayerName="match.players[1].username"
              :leftPlayerDisconnected="
                match.disconnectedPlayer &&
                match.players[0].intra_id === match.disconnectedPlayer.intra_id
              "
              :rightPlayerDisconnected="
                match.disconnectedPlayer &&
                match.players[1].intra_id === match.disconnectedPlayer.intra_id
              "
              :leftPlayerIntraId="match.players[0].intra_id"
              :myIntraId="user.intra_id"
              :leftPlayerScore="match.leftScore"
              :rightPlayerScore="match.rightScore"
              :gamemode="match.gamemode"
            />
          </div>
        </div>
      </div>
      <br />
      <Achievements :intraId="intra_id" />

      <br />
      <button class="btn text-xl" @click="handleBlock">
        {{ blocked ? 'Unblock' : 'Block' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import MatchReport from './profile/MatchReport.vue'
import Achievements from './achievements/Achievements.vue'
import { get, getImage } from '../../httpRequests'
import { Socket } from 'socket.io-client'
import { inject, ref } from 'vue'

const props = defineProps({ intraId: String })
const intra_id = parseInt(props.intraId!)
const gameSocket: Socket = inject('gameSocket')!

const user = await get(`api/user/other/${intra_id}`)
const username = user.username
const wins = user.wins
const losses = user.losses
const profilePicture = await getImage(`api/user/profilePicture/${intra_id}.png`)
const matchHistory = await get(`api/user/matchHistory/${intra_id}`)

const blocked = ref(await get(`api/user/hasBlocked/${intra_id}`))

function inviteToGame() {
  gameSocket.emit('createPrivateLobby', {
    invitedUser: intra_id,
    gamemode: localStorage.getItem('gamemode')
  })
}

async function handleBlock() {
  await get('api/user/' + (blocked.value ? 'un' : '') + 'block/' + intra_id)
  blocked.value = !blocked.value
}
</script>
