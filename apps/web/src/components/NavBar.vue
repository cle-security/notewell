<script setup lang="ts">
import { useAuthStore } from "../stores/auth";
import { useRouter } from "vue-router";

const auth = useAuthStore();
const router = useRouter();

async function logout() {
  await auth.logout();
  router.push("/login");
}
</script>

<template>
  <nav class="nav">
    <RouterLink to="/notes" class="brand">Notewell</RouterLink>
    <RouterLink v-if="auth.isAuthed" to="/me">me</RouterLink>
    <RouterLink v-if="auth.isAdmin" to="/admin">admin</RouterLink>
    <span class="spacer" />
    <template v-if="auth.isAuthed">
      <span class="muted">{{ auth.user?.username }}</span>
      <button @click="logout">log out</button>
    </template>
    <template v-else>
      <RouterLink to="/login">log in</RouterLink>
      <RouterLink to="/signup">sign up</RouterLink>
    </template>
  </nav>
</template>
