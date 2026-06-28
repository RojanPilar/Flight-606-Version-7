<script setup>
</script>
<template>
  <div class="page active">
    <div class="inner-page">

      <div class="inner-hero">
        <div class="container text-center">
          <p class="hero-eyebrow">Flight 606 · Luxury Redefined</p>
          <h1 class="hero-title">Escape The <em>Ordinary</em> World</h1>
          <p class="hero-sub">Find your personal sanctuary in secluded corners of the globe</p>
        </div>
      </div>

      <div class="pt-5">
        <div class="container">
          <div class="text-center mb-5">
            <h1 class="section-title" style="font-family:'Playfair Display',serif; font-size:clamp(2rem,4vw,3rem);">Contact <em class="gold">Us</em></h1>
            <p class="body-text">Any question or remarks? Just write us a message!</p>
          </div>
          <div class="contact-layout">
            <div class="contact-info">
              <h2>Contact Information</h2>
              <p>Say something to start a live chat!</p>
              <div class="contact-detail"><div class="contact-icon"><i class="bi bi-telephone"></i></div><div>+1012 3456 789</div></div>
              <div class="contact-detail"><div class="contact-icon"><i class="bi bi-envelope"></i></div><div>demo@flight606.com</div></div>
              <div class="contact-detail"><div class="contact-icon"><i class="bi bi-geo-alt"></i></div><div>132 Dartmouth Street Boston, MA 02156</div></div>
              <div class="contact-socials">
                <a href="#" class="contact-soc"><i class="bi bi-twitter-x"></i></a>
                <a href="#" class="contact-soc"><i class="bi bi-instagram"></i></a>
                <a href="#" class="contact-soc"><i class="bi bi-chat"></i></a>
              </div>
            </div>
            <div class="contact-form-panel">
              <h3 class="mb-4">Send a Message</h3>
              <div class="row g-3">
                <div class="col-6"><label class="f-label">First Name</label><input type="text" class="f-input" placeholder="John"></div>
                <div class="col-6"><label class="f-label">Last Name</label><input type="text" class="f-input" placeholder="Doe"></div>
                <div class="col-6"><label class="f-label">Email</label><input type="email" class="f-input" placeholder="your@email.com"></div>
                <div class="col-6"><label class="f-label">Phone</label><input type="tel" class="f-input" placeholder="+1 012 3456 789"></div>
              </div>
              <div class="mt-3">
                <label class="f-label">Select Subject</label>
                <div class="cf-subjects">
                  <label class="r-lbl"><input type="radio" name="subj" checked><span>General Inquiry</span></label>
                  <label class="r-lbl"><input type="radio" name="subj"><span>Booking Support</span></label>
                  <label class="r-lbl"><input type="radio" name="subj"><span>Refunds</span></label>
                  <label class="r-lbl"><input type="radio" name="subj"><span>Other</span></label>
                </div>
              </div>
              <div class="mt-3">
                <label class="f-label">Message</label>
                <textarea class="f-input cf-textarea" placeholder="Write your message.."></textarea>
              </div>
              <div class="d-flex justify-content-end mt-3 mb-4">
                <button class="btn-gold-full" style="width:auto; padding:12px 36px;">Send Message</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>