<template>
  <Teleport to="body">
    <div v-if="isOpen" class="shortcuts-overlay" @click.self="$emit('close')">
      <div class="shortcuts-panel">
        <div class="shortcuts-header">
          <span class="shortcuts-title">Keyboard Shortcuts</span>
          <button class="shortcuts-close" @click="$emit('close')" aria-label="Close shortcuts help">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="shortcuts-body">
          <div class="shortcut-group">
            <div class="group-label">Navigation</div>
            <div class="shortcut-row">
              <kbd>1</kbd><span>Agents tab</span>
            </div>
            <div class="shortcut-row">
              <kbd>2</kbd><span>Worktrees tab</span>
            </div>
            <div class="shortcut-row">
              <kbd>3</kbd><span>Tasks tab</span>
            </div>
            <div class="shortcut-row">
              <kbd>4</kbd><span>Live tab</span>
            </div>
            <div class="shortcut-row">
              <kbd>5</kbd><span>History tab</span>
            </div>
          </div>
          <div class="shortcut-group">
            <div class="group-label">Actions</div>
            <div class="shortcut-row">
              <kbd>F</kbd><span>Toggle filters (Live tab)</span>
            </div>
            <div class="shortcut-row">
              <kbd>?</kbd><span>Toggle this help</span>
            </div>
            <div class="shortcut-row">
              <kbd>Esc</kbd><span>Close overlay / panel</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{ isOpen: boolean }>();
defineEmits<{ close: [] }>();
</script>

<style scoped>
.shortcuts-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.shortcuts-panel {
  background: var(--theme-bg-primary);
  border: 1px solid var(--theme-border-primary);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  width: 340px;
  max-width: 90vw;
  overflow: hidden;
  animation: scaleIn 0.15s ease;
}

@keyframes scaleIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.shortcuts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--theme-border-primary);
  background: var(--theme-bg-secondary);
}

.shortcuts-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--theme-text-primary);
}

.shortcuts-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: var(--theme-bg-tertiary);
  color: var(--theme-text-secondary);
  cursor: pointer;
  transition: background 0.15s;
}
.shortcuts-close:hover {
  background: var(--theme-bg-quaternary);
  color: var(--theme-text-primary);
}

.shortcuts-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.shortcut-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--theme-text-tertiary);
  margin-bottom: 2px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--theme-text-secondary);
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  padding: 0 6px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--theme-text-primary);
  background: var(--theme-bg-tertiary);
  border: 1px solid var(--theme-border-secondary);
  border-radius: 5px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
</style>
