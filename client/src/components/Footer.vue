<script setup>
const year = new Date().getFullYear()
</script>

<template>
  <footer class="site-footer">
    <div class="container">
      <div class="row g-4 mb-5">
        <div class="col-6 col-md-3 col-lg">
          <p class="footer-heading">Other Offerings</p>
          <ul class="footer-links">
            <li><a href="#">PHplus</a></li>
            <li><a href="#">Temptations</a></li>
            <li><a href="#">More</a></li>
          </ul>
        </div>
        <div class="col-6 col-md-3 col-lg">
          <p class="footer-heading">About Us</p>
          <ul class="footer-links">
            <li><a href="#">Corporate Governance</a></li>
            <li><a href="#">Leadership</a></li>
            <li><a href="#">Join Us</a></li>
          </ul>
        </div>
        <div class="col-6 col-md-3 col-lg">
          <p class="footer-heading">Corporate Travel</p>
          <ul class="footer-links">
            <li><a href="#">PHcorporate</a></li>
            <li><a href="#">PHcorporate SME</a></li>
          </ul>
        </div>
        <div class="col-6 col-md-3 col-lg">
          <p class="footer-heading">Help</p>
          <ul class="footer-links">
            <li><RouterLink :to="{ name: 'FlightStatus' }">Flight Status</RouterLink></li>
            <li><RouterLink :to="{ name: 'CheckIn' }">Check-in</RouterLink></li>
            <li><RouterLink :to="{ name: 'Contact' }">Contact</RouterLink></li>
          </ul>
        </div>
        <div class="col-lg-3">
          <p class="footer-heading">Subscribe to our offers</p>
          <div class="sub-wrap">
            <input type="email" class="sub-input" placeholder="your@email.com">
            <button class="sub-btn">Subscribe</button>
          </div>
          <p class="footer-connect-label">Connect With Us</p>
          <div class="soc-row">
            <a href="#" class="soc-i" aria-label="Twitter/X"><i class="bi bi-twitter-x"></i></a>
            <a href="#" class="soc-i" aria-label="Facebook"><i class="bi bi-facebook"></i></a>
            <a href="#" class="soc-i" aria-label="YouTube"><i class="bi bi-youtube"></i></a>
            <a href="#" class="soc-i" aria-label="Instagram"><i class="bi bi-instagram"></i></a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="footer-legal">
          <a href="#">Legal</a><a href="#">Privacy</a><a href="#">Accessibility</a><a href="#">Terms &amp; Conditions</a>
        </div>
        <span class="footer-copy">© {{ year }} Batch 606</span>
      </div>
    </div>
  </footer>
</template>
