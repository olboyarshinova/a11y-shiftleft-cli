<template>
  <main>
    <h1>Account settings</h1>
    <button @click="save">Save</button>
    <div v-html="trustedHtml" />
  </main>
</template>

<script setup>
const trustedHtml = "<strong>Status changed</strong>";

function save() {}
</script>
