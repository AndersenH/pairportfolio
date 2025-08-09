#!/usr/bin/env python3

"""
Authentication Test Script (Python Version)
Tests the complete authentication flow including:
- User registration
- User login  
- Session verification
- Protected route access
- Logout
"""

import requests
import json
import time
import sys
import os
from datetime import datetime
from typing import Dict, Optional, Tuple

# Configuration
BASE_URL = "http://localhost:3000"
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "https://sgeuatzvbxaohjebipwv.supabase.co")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", 
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZXVhdHp2Ynhhb2hqZWJpcHd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4ODE0OTQsImV4cCI6MjA1NTQ1NzQ5NH0.Gog8NxnUXMggGFhTqhO2A3uifkV_ocF6AJKIzQ2wGzs")

# Test user credentials
TEST_USER = {
    "email": f"test_{int(time.time())}@example.com",
    "password": "TestPassword123!",
    "name": "Test User"
}

# ANSI color codes for terminal output
class Colors:
    RESET = '\033[0m'
    BOLD = '\033[1m'
    RED = '\033[31m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    BLUE = '\033[34m'
    CYAN = '\033[36m'


class AuthenticationTester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        self.refresh_token = None
        self.user_id = None
        self.results = {"total": 0, "passed": 0, "failed": 0}
        
    def print_header(self):
        """Print test suite header"""
        print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.BLUE}     Authentication System Test Suite (Python){Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
        print(f"\n{Colors.YELLOW}Testing against: {BASE_URL}{Colors.RESET}")
        print(f"{Colors.YELLOW}Supabase URL: {SUPABASE_URL}{Colors.RESET}")
        print(f"{Colors.YELLOW}Timestamp: {datetime.now().isoformat()}{Colors.RESET}\n")
        
    def check_server(self) -> bool:
        """Check if the server is running"""
        print(f"{Colors.CYAN}Checking if server is running...{Colors.RESET}")
        try:
            response = requests.head(f"{BASE_URL}/", timeout=5)
            if response.status_code == 200:
                print(f"{Colors.GREEN}✓ Server is running{Colors.RESET}")
                return True
        except requests.exceptions.RequestException as e:
            pass
        
        print(f"{Colors.RED}✗ Server is not running at {BASE_URL}{Colors.RESET}")
        print(f"{Colors.YELLOW}Please start the server with: npm run dev{Colors.RESET}")
        return False
        
    def test_health_check(self) -> bool:
        """Test the health check endpoint"""
        print(f"{Colors.CYAN}Testing health check...{Colors.RESET}")
        self.results["total"] += 1
        
        try:
            response = self.session.get(f"{BASE_URL}/api/health", timeout=10)
            if response.status_code in [200, 503]:
                print(f"{Colors.GREEN}✓ Health check endpoint responding{Colors.RESET}")
                if response.status_code == 200:
                    data = response.json()
                    print(f"  Status: {data.get('status', 'unknown')}")
                    print(f"  Environment: {data.get('environment', 'unknown')}")
                self.results["passed"] += 1
                return True
        except Exception as e:
            print(f"{Colors.RED}✗ Health check error: {str(e)}{Colors.RESET}")
            
        self.results["failed"] += 1
        return False
        
    def test_registration(self) -> bool:
        """Test user registration"""
        print(f"\n{Colors.CYAN}Testing user registration...{Colors.RESET}")
        print(f"  Email: {TEST_USER['email']}")
        self.results["total"] += 1
        
        try:
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "email": TEST_USER["email"],
                "password": TEST_USER["password"],
                "data": {"name": TEST_USER["name"]}
            }
            
            response = requests.post(
                f"{SUPABASE_URL}/auth/v1/signup",
                headers=headers,
                json=payload,
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                print(f"{Colors.GREEN}✓ User registration successful{Colors.RESET}")
                data = response.json()
                if "user" in data:
                    self.user_id = data["user"].get("id")
                    print(f"  User ID: {self.user_id}")
                    confirmed = data["user"].get("confirmed_at")
                    print(f"  Email confirmed: {'Yes' if confirmed else 'No (check email)'}")
                self.results["passed"] += 1
                return True
            elif response.status_code == 400:
                data = response.json()
                if "already registered" in str(data).lower():
                    print(f"{Colors.YELLOW}⚠ User already exists (OK for testing){Colors.RESET}")
                    self.results["passed"] += 1
                    return True
                    
            print(f"{Colors.RED}✗ Registration failed: {response.status_code}{Colors.RESET}")
            if response.text:
                print(f"  Response: {response.text[:200]}")
                
        except Exception as e:
            print(f"{Colors.RED}✗ Registration error: {str(e)}{Colors.RESET}")
            
        self.results["failed"] += 1
        return False
        
    def test_login(self) -> bool:
        """Test user login"""
        print(f"\n{Colors.CYAN}Testing user login...{Colors.RESET}")
        self.results["total"] += 1
        
        try:
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "email": TEST_USER["email"],
                "password": TEST_USER["password"]
            }
            
            response = requests.post(
                f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                headers=headers,
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                print(f"{Colors.GREEN}✓ Login successful{Colors.RESET}")
                data = response.json()
                self.access_token = data.get("access_token")
                self.refresh_token = data.get("refresh_token")
                
                print(f"  Access token received: {'Yes' if self.access_token else 'No'}")
                print(f"  Refresh token received: {'Yes' if self.refresh_token else 'No'}")
                print(f"  Token type: {data.get('token_type', 'unknown')}")
                print(f"  Expires in: {data.get('expires_in', 'unknown')} seconds")
                
                self.results["passed"] += 1
                return True
                
            print(f"{Colors.RED}✗ Login failed: {response.status_code}{Colors.RESET}")
            if response.text:
                print(f"  Response: {response.text[:200]}")
                
        except Exception as e:
            print(f"{Colors.RED}✗ Login error: {str(e)}{Colors.RESET}")
            
        self.results["failed"] += 1
        return False
        
    def test_session_verification(self) -> bool:
        """Test session verification"""
        print(f"\n{Colors.CYAN}Testing session verification...{Colors.RESET}")
        self.results["total"] += 1
        
        if not self.access_token:
            print(f"{Colors.YELLOW}⚠ No access token available{Colors.RESET}")
            self.results["failed"] += 1
            return False
            
        try:
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {self.access_token}"
            }
            
            response = requests.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                print(f"{Colors.GREEN}✓ Session is valid{Colors.RESET}")
                data = response.json()
                print(f"  User ID: {data.get('id', 'unknown')}")
                print(f"  Email: {data.get('email', 'unknown')}")
                print(f"  Role: {data.get('role', 'unknown')}")
                self.results["passed"] += 1
                return True
                
            print(f"{Colors.RED}✗ Session invalid: {response.status_code}{Colors.RESET}")
            
        except Exception as e:
            print(f"{Colors.RED}✗ Session verification error: {str(e)}{Colors.RESET}")
            
        self.results["failed"] += 1
        return False
        
    def test_protected_route(self) -> bool:
        """Test access to protected routes"""
        print(f"\n{Colors.CYAN}Testing protected route access...{Colors.RESET}")
        self.results["total"] += 1
        
        if not self.access_token:
            print(f"{Colors.YELLOW}⚠ No access token available{Colors.RESET}")
            self.results["failed"] += 1
            return False
            
        try:
            # Test with Supabase token in cookie format
            cookies = {
                "sb-access-token": self.access_token,
                "sb-refresh-token": self.refresh_token or ""
            }
            
            response = self.session.get(
                f"{BASE_URL}/api/portfolios",
                cookies=cookies,
                timeout=10
            )
            
            if response.status_code == 200:
                print(f"{Colors.GREEN}✓ Protected route accessible{Colors.RESET}")
                self.results["passed"] += 1
                return True
            elif response.status_code == 401:
                # Try with Authorization header
                headers = {"Authorization": f"Bearer {self.access_token}"}
                response = self.session.get(
                    f"{BASE_URL}/api/portfolios",
                    headers=headers,
                    timeout=10
                )
                
                if response.status_code == 200:
                    print(f"{Colors.GREEN}✓ Protected route accessible (with header){Colors.RESET}")
                    self.results["passed"] += 1
                    return True
                else:
                    print(f"{Colors.YELLOW}⚠ Protected route requires different auth method{Colors.RESET}")
                    self.results["failed"] += 1
                    return False
                    
            print(f"{Colors.RED}✗ Protected route failed: {response.status_code}{Colors.RESET}")
            
        except Exception as e:
            print(f"{Colors.RED}✗ Protected route error: {str(e)}{Colors.RESET}")
            
        self.results["failed"] += 1
        return False
        
    def test_logout(self) -> bool:
        """Test logout functionality"""
        print(f"\n{Colors.CYAN}Testing logout...{Colors.RESET}")
        self.results["total"] += 1
        
        if not self.access_token:
            print(f"{Colors.YELLOW}⚠ No access token available{Colors.RESET}")
            self.results["failed"] += 1
            return False
            
        try:
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {self.access_token}"
            }
            
            response = requests.post(
                f"{SUPABASE_URL}/auth/v1/logout",
                headers=headers,
                timeout=10
            )
            
            if response.status_code in [200, 204]:
                print(f"{Colors.GREEN}✓ Logout successful{Colors.RESET}")
                self.results["passed"] += 1
                return True
                
            print(f"{Colors.RED}✗ Logout failed: {response.status_code}{Colors.RESET}")
            
        except Exception as e:
            print(f"{Colors.RED}✗ Logout error: {str(e)}{Colors.RESET}")
            
        self.results["failed"] += 1
        return False
        
    def test_session_after_logout(self) -> bool:
        """Verify session is invalid after logout"""
        print(f"\n{Colors.CYAN}Testing session after logout...{Colors.RESET}")
        self.results["total"] += 1
        
        if not self.access_token:
            print(f"{Colors.YELLOW}⚠ No access token available{Colors.RESET}")
            self.results["failed"] += 1
            return False
            
        try:
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {self.access_token}"
            }
            
            response = requests.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers=headers,
                timeout=10
            )
            
            if response.status_code != 200:
                print(f"{Colors.GREEN}✓ Session properly invalidated{Colors.RESET}")
                self.results["passed"] += 1
                return True
                
            print(f"{Colors.RED}✗ Session still valid after logout{Colors.RESET}")
            
        except Exception as e:
            print(f"{Colors.GREEN}✓ Session properly invalidated (error as expected){Colors.RESET}")
            self.results["passed"] += 1
            return True
            
        self.results["failed"] += 1
        return False
        
    def print_summary(self):
        """Print test results summary"""
        print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.BLUE}     Test Results Summary{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
        
        print(f"\n{Colors.BOLD}Total Tests: {self.results['total']}{Colors.RESET}")
        print(f"{Colors.GREEN}Passed: {self.results['passed']}{Colors.RESET}")
        print(f"{Colors.RED}Failed: {self.results['failed']}{Colors.RESET}")
        
        if self.results['total'] > 0:
            success_rate = (self.results['passed'] / self.results['total']) * 100
            if success_rate == 100:
                status_color = Colors.GREEN
            elif success_rate >= 70:
                status_color = Colors.YELLOW
            else:
                status_color = Colors.RED
                
            print(f"{status_color}Success Rate: {success_rate:.1f}%{Colors.RESET}")
            
            if self.results['failed'] == 0:
                print(f"\n{Colors.GREEN}{Colors.BOLD}✓ All tests passed!{Colors.RESET}")
                print(f"{Colors.GREEN}Authentication system is working correctly.{Colors.RESET}")
            elif self.results['failed'] <= 2:
                print(f"\n{Colors.YELLOW}{Colors.BOLD}⚠ Some tests failed.{Colors.RESET}")
                print(f"{Colors.YELLOW}The system is partially working.{Colors.RESET}")
            else:
                print(f"\n{Colors.RED}{Colors.BOLD}✗ Multiple tests failed.{Colors.RESET}")
                print(f"{Colors.RED}Check your configuration and server logs.{Colors.RESET}")
                
        print(f"\n{Colors.CYAN}Test user: {TEST_USER['email']}{Colors.RESET}")
        print(f"{Colors.CYAN}Remember to clean up test users in Supabase.{Colors.RESET}")
        
    def run_all_tests(self):
        """Run all authentication tests"""
        self.print_header()
        
        if not self.check_server():
            sys.exit(1)
            
        # Wait for server to be ready
        time.sleep(1)
        
        # Run tests in sequence
        self.test_health_check()
        
        if self.test_registration():
            if self.test_login():
                self.test_session_verification()
                self.test_protected_route()
                self.test_logout()
                self.test_session_after_logout()
            else:
                print(f"{Colors.YELLOW}⚠ Skipping session tests due to login failure{Colors.RESET}")
        else:
            print(f"{Colors.YELLOW}⚠ Skipping login tests due to registration failure{Colors.RESET}")
            
        self.print_summary()
        
        # Exit with appropriate code
        sys.exit(0 if self.results['failed'] == 0 else 1)


def main():
    """Main entry point"""
    tester = AuthenticationTester()
    tester.run_all_tests()


if __name__ == "__main__":
    main()