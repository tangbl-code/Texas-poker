<script setup lang="ts">
import { X, LogOut } from 'lucide-vue-next'
defineProps<{ host: boolean; solo?: boolean }>()
const emit = defineEmits<{ close: []; confirm: [] }>()
</script>
<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
      <section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <button class="icon-button close" title="取消" @click="emit('close')"><X :size="20" /></button>
        <div class="dialog-icon"><LogOut :size="25" /></div>
        <h2 id="confirm-title">{{ host ? '结束这场牌局？' : '离开房间？' }}</h2>
        <p>{{ solo ? '本次单机对局将结束，机器人停止行动，本局筹码和牌局数据会被清除。' : host ? '所有玩家将断开连接，本局筹码和牌局数据会被清除。' : '离开后可使用原房间码重新加入。对局中的座位和筹码仍会保留。' }}</p>
        <div class="dialog-actions"><button class="button secondary" autofocus @click="emit('close')">继续对局</button><button class="button danger" @click="emit('confirm')">{{ host ? '结束并清零' : '离开房间' }}</button></div>
      </section>
    </div>
  </Teleport>
</template>
<style scoped>
.modal-backdrop { position: fixed; inset: 0; z-index: 100; background: #13221ca3; display: grid; place-items: center; padding: 20px; backdrop-filter: blur(5px); }
.confirm-dialog { width: 100%; max-width: 410px; background: white; padding: 30px; border-radius: 8px; position: relative; }
.close { position: absolute; right: 12px; top: 12px; }
.dialog-icon { color: #b55750; margin: 8px 0 20px; }
h2 { margin: 0; font-size: 22px; }
p { color: var(--muted); font-size: 14px; line-height: 1.8; margin: 15px 0 26px; }
.dialog-actions { display: flex; gap: 10px; justify-content: end; }
</style>
