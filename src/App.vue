<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomStore } from './stores/room'

const room = useRoomStore()
const route = useRoute()
const router = useRouter()
watch([() => !!room.view?.game, () => route.path], ([playing, path]) => {
  const destination = playing ? '/table' : '/'
  if (path !== destination) void router.replace(destination)
}, { immediate: true })
</script>

<template><RouterView /></template>
