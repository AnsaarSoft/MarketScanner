const nodemailer = require('nodemailer');
                                                                                                                          
  async function SendEmail(to, subject, htmlContent) {                                                                    
  try {                                                                                                                   
  const transporter = nodemailer.createTransport({                                                                        
  host: process.env.SMTP_HOST,                                                                                            
  port: Number(process.env.SMTP_PORT),                                                                                    
  secure: Number(process.env.SMTP_PORT) === 465,                                                                          
  auth: {                                                                                                                 
  user: process.env.SMTP_USER,                                                                                            
  pass: process.env.SMTP_PASS                                                                                             
  }                                                                                                                       
  });                                                                                                                     
                                                                                                                          
      return await transporter.sendMail({                                                                                 
        from: process.env.SMTP_USER,                                                                                      
        to,                                                                                                               
        subject,                                                                                                          
        html: htmlContent                                                                                                 
      });                                                                                                                 
                                                                                                                          
  } catch (err) {                                                                                                         
  throw err;                                                                                                              
  }                                                                                                                       
  }                                                                                                                       
                                                                                                                          
  module.exports = { SendEmail };  