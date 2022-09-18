/* eslint-disable react/no-unknown-property */
import { GradientText, Section } from '@/components';

const ContactForm = () => (
  <Section>
    <p className="text-center font-bold text-[2.2em] mb-8 -mt-2">
      <GradientText>
        Contact
      </GradientText>
    </p>
    <div className='flex justify-center'>
      <form name="contact" method="POST" data-netlify="true">
        <div>
          <p className='text-center text-md font-semibold mb-2'>Your Name</p>
          <input className='input input-bordered w-full max-w-sm mb-2' type="text" name="name" />
        </div>
        <div>
          <p className='text-center text-md font-semibold mb-2'>Your Email</p>
          <input className='input input-bordered w-full max-w-sm mb-2' type="email" name="email" />
        </div>
        <div>
          <p className='text-center text-md font-semibold mb-2'>Message</p>
            <textarea className='input input-bordered h-[72px] w-full max-w-sm mb-2' name="message"></textarea>
        </div>
        <div className='text-center'>
          <button className='btn btn-success' type="submit">Send</button>
        </div>
      </form>
    </div>
  </Section>
);

export { ContactForm };
