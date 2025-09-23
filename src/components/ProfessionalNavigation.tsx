import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import NotificationDropdown from './NotificationDropdown';
import { cn } from '@/lib/utils';
import {
  Home,
  Search,
  FileText,
  Users,
  BarChart3,
  Settings,
  LogOut,
  User,
  ChevronDown,
  Shield,
  TrendingUp,
  Building2,
  BookOpen,
  HelpCircle,
  Mail
} from 'lucide-react';

const ProfessionalNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const features = [
    {
      title: "Property Analysis",
      description: "AI-powered disclosure analysis",
      icon: BarChart3,
      href: "/",
    },
    {
      title: "Risk Assessment",
      description: "Identify potential property issues",
      icon: Shield,
      href: "/",
    },
    {
      title: "Cost Estimation",
      description: "Get repair cost estimates",
      icon: TrendingUp,
      href: "/",
    },
    {
      title: "Agent Network",
      description: "Connect with verified agents",
      icon: Building2,
      href: "/auth",
    },
  ];

  const resources = [
    {
      title: "Documentation",
      description: "Learn how to use IntelleHouse",
      icon: BookOpen,
      href: "#",
    },
    {
      title: "Support",
      description: "Get help from our team",
      icon: HelpCircle,
      href: "#",
    },
    {
      title: "Contact",
      description: "Reach out to us",
      icon: Mail,
      href: "#",
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full nav-gradient">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link 
          to="/" 
          className="flex items-center space-x-2 font-bold text-xl hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-hover rounded-lg flex items-center justify-center">
            <Home className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent">
            IntelleHouse
          </span>
        </Link>

        {/* Desktop Navigation */}
        <NavigationMenu className="hidden lg:flex">
          <NavigationMenuList>
            {/* Features Dropdown */}
            <NavigationMenuItem>
              <NavigationMenuTrigger className="h-9">
                Features
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-[600px] grid-cols-2 gap-3 p-4">
                  {features.map((feature) => (
                    <NavigationMenuLink key={feature.title} asChild>
                      <Link
                        to={feature.href}
                        className="group block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                      >
                        <div className="flex items-center gap-2">
                          <feature.icon className="w-4 h-4 text-primary" />
                          <div className="text-sm font-medium leading-none">
                            {feature.title}
                          </div>
                        </div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                          {feature.description}
                        </p>
                      </Link>
                    </NavigationMenuLink>
                  ))}
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>

            {/* Resources Dropdown */}
            <NavigationMenuItem>
              <NavigationMenuTrigger className="h-9">
                Resources
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-[400px] gap-3 p-4">
                  {resources.map((resource) => (
                    <NavigationMenuLink key={resource.title} asChild>
                      <Link
                        to={resource.href}
                        className="group block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                      >
                        <div className="flex items-center gap-2">
                          <resource.icon className="w-4 h-4 text-primary" />
                          <div className="text-sm font-medium leading-none">
                            {resource.title}
                          </div>
                        </div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                          {resource.description}
                        </p>
                      </Link>
                    </NavigationMenuLink>
                  ))}
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>

            {/* Pricing */}
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link
                  to="#"
                  className={cn(
                    "group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50"
                  )}
                >
                  Pricing
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        {/* Auth Section */}
        <div className="flex items-center space-x-4">
          {user ? (
            <>
              {/* Notification Bell */}
              <NotificationDropdown />
              
              {/* Dashboard Links */}
              <Button variant="ghost" size="sm" asChild className="hidden md:flex">
                <Link to="/buyer-dashboard">
                  <User className="w-4 h-4 mr-2" />
                  Buyer Dashboard
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="hidden md:flex">
                <Link to="/agent-dashboard">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Agent Dashboard
                </Link>
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 dropdown-content" align="end">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.user_metadata?.first_name || 'User'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/agent-dashboard-new" className="w-full">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/agent-dashboard-new" className="w-full">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Log in</Link>
              </Button>
              <Button size="sm" className="btn-primary" asChild>
                <Link to="/auth">
                  Get Started
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="sm">
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 dropdown-content" align="end">
            <DropdownMenuItem asChild>
              <Link to="/" className="w-full">
                <Home className="mr-2 h-4 w-4" />
                <span>Home</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/buyer-dashboard" className="w-full">
                <User className="mr-2 h-4 w-4" />
                <span>Buyer Dashboard</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/agent-dashboard" className="w-full">
                <BarChart3 className="mr-2 h-4 w-4" />
                <span>Agent Dashboard</span>
              </Link>
            </DropdownMenuItem>
            {!user && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/auth" className="w-full">
                    <User className="mr-2 h-4 w-4" />
                    <span>Sign in</span>
                  </Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default ProfessionalNavigation;