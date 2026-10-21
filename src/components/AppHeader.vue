<script setup lang="ts">
import { ArrowLeft, Bot, Spade, Wifi, WifiOff } from 'lucide-vue-next'
withDefaults(defineProps<{ atTable?: boolean; solo?: boolean; connected?: boolean }>(), { atTable: false, solo: false, connected: true })
defineEmits<{ leave: [] }>()
</script>

<template>
  <header class="site-header">
    <div class="brand"><span class="brand-symbol"><Spade :size="23" fill="currentColor" /></span><span class="brand-name">同桌<small>TABLEMATES</small></span></div>
    <span class="header-caption">{{ atTable ? "TEXAS HOLD'EM" : 'FRIENDS AT THE TABLE' }}</span>
    <div class="header-right"><span v-if="atTable" class="status" :class="{ offline: !connected }"><component :is="solo ? Bot : connected ? Wifi : WifiOff" :size="15" />{{ solo ? '单机对局' : connected ? '房间在线' : '连接断开' }}</span><button v-if="atTable" class="leave-table" title="离开牌桌" @click="$emit('leave')"><ArrowLeft :size="17" /><span>离开牌桌</span></button><span v-else class="header-edition">POKER NIGHT / VOL. 01</span></div>
  </header>
</template>

<style scoped>
.site-header { height: 72px; padding: 0 4%; background: #fff; border-bottom: 1px solid #e4e9e1; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.brand { display: flex; align-items: center; gap: 10px; }.brand-symbol { color: #275b43; display: grid; place-items: center; width: 37px; height: 40px; border: 1px solid #d6e0d4; border-radius: 6px; }.brand-name { font-size: 22px; font-weight: 700; line-height: 1; }.brand-name small { display: block; font-size: 8px; font-weight: 600; margin-top: 6px; }.header-caption,.header-edition { font-size: 9px; color: #8d998b; }.header-right { display: flex; align-items: center; gap: 20px; }.status { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #6d846b; }.status.offline { color: #bf655e; }.leave-table { background: none; border: 0; color: #74846d; display: flex; align-items: center; gap: 6px; padding: 8px; font-size: 11px; border-radius: 4px; }.leave-table:hover { background: #eef2e9; color: #275b43; }
@media(max-width:600px) { .site-header { height: 62px; padding: 0 18px; }.header-caption { display: none; }.header-edition { font-size: 8px; }.header-right { gap: 10px; }.leave-table span { display: none; }.brand-name { font-size: 20px; }.brand-symbol { width: 33px; height: 36px; } }
</style>
