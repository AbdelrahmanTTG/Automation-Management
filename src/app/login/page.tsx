"use client";
import React, { Fragment, useState } from 'react';
import { Button, Form, FormGroup, Input, Label ,Container , Row, Col, TabContent, TabPane } from 'reactstrap';
import { EmailAddress, ForgotPassword, Javascript, Password, RememberPassword } from '@/packages/Constant';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import axiosClient from '../AxiosClint'
// import { usePermissions } from "../../packages/contexts/PermissionContext";

const LoginTab = () => {
  const [email, setEmail] = useState('mohamed.elghamry@thetranslationgate.com');
  const [password, setPassword] = useState('123456');
  const [togglePassword, setTogglePassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
// const { setUser } = usePermissions(); 
const loginAuth = async (e: any) => {
  e.preventDefault();
  setLoading(true);

  try {
    const res = await axiosClient.post("api/login", {
      email,
      password,
    });
    const { token, user } = res.data;
    Cookies.set("ACCESS_TOKEN", token, { expires: 1, sameSite: "strict", secure: false });
    Cookies.set("USER", JSON.stringify(user), { expires: 1, sameSite: "strict", secure: false });
    
    // setUser(user);
    router.push("/dashboard");
  } catch (error: any) {
    console.error(error);
    alert(error.response?.data?.message || "Login failed");
    setLoading(false);
  }
};


  return (
    <Container fluid={true} className='p-0'>
      <Row>
        <Col xs='12'>
          <div className='login-card'>
            <div className='login-main login-tab'>
              <TabContent className='content-login'>
                <TabPane>
                  <Fragment>
                    <Form className='theme-form'>
                      <h4>Sign In</h4>
                      <p>Enter your email & password to login</p>
                      <FormGroup>
                        <Label className='col-form-label'>{EmailAddress}</Label>
                        <Input
                          type='email'
                          required
                          onChange={(e) => setEmail(e.target.value)}
                          value={email}
                        />
                      </FormGroup>
                      <FormGroup className='position-relative'>
                        <Label className='col-form-label'>{Password}</Label>
                        <Input
                          type={togglePassword ? 'text' : 'password'}
                          onChange={(e) => setPassword(e.target.value)}
                          value={password}
                          required
                        />
                        <div className='show-hide' onClick={() => setTogglePassword(!togglePassword)}>
                          <span className={togglePassword ? '' : 'show'}></span>
                        </div>
                      </FormGroup>
                      <div className='form-group mb-0'>
                        {/* <div className='checkbox ms-3'>
                          <Input id='checkbox1' type='checkbox' />
                          <Label className='text-muted' for='checkbox1'>
                            {RememberPassword}
                          </Label>
                        </div>
                        <a className='link' href={Javascript}>
                          {ForgotPassword}
                        </a> */}
                        <Button color='primary' className='btn-block' onClick={loginAuth} disabled={loading}>
                          {loading ? "Logging in..." : "Login"}
                        </Button>
                      </div>
                    </Form>
                  </Fragment>
                </TabPane>
              </TabContent>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default LoginTab;
